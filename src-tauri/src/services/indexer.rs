use anyhow::Result;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{doc, Index, IndexWriter, ReloadPolicy};
use std::sync::Mutex;

use crate::models::vault::SearchResult;

/// Full-text search index using Tantivy
pub struct SearchIndex {
    index: Index,
    writer: Mutex<IndexWriter>,
    path_field: Field,
    title_field: Field,
    body_field: Field,
    tags_field: Field,
}

impl SearchIndex {
    /// Create an in-memory search index
    pub fn new() -> Result<Self> {
        let mut schema_builder = Schema::builder();
        let path_field = schema_builder.add_text_field("path", STRING | STORED);
        let title_field = schema_builder.add_text_field("title", TEXT | STORED);
        let body_field = schema_builder.add_text_field("body", TEXT | STORED);
        let tags_field = schema_builder.add_text_field("tags", TEXT | STORED);
        let schema = schema_builder.build();

        let index = Index::create_in_ram(schema);
        let writer = index.writer(50_000_000)?; // 50MB heap

        Ok(Self {
            index,
            writer: Mutex::new(writer),
            path_field,
            title_field,
            body_field,
            tags_field,
        })
    }

    /// Index a single note
    pub fn index_note(&self, path: &str, title: &str, body: &str, tags: &[String]) -> Result<()> {
        let mut writer = self.writer.lock().unwrap();

        // Delete existing document with this path
        let path_term = tantivy::Term::from_field_text(self.path_field, path);
        writer.delete_term(path_term);

        // Add the document
        writer.add_document(doc!(
            self.path_field => path,
            self.title_field => title,
            self.body_field => body,
            self.tags_field => tags.join(" "),
        ))?;

        writer.commit()?;
        Ok(())
    }

    /// Remove a note from the index
    pub fn remove_note(&self, path: &str) -> Result<()> {
        let mut writer = self.writer.lock().unwrap();
        let path_term = tantivy::Term::from_field_text(self.path_field, path);
        writer.delete_term(path_term);
        writer.commit()?;
        Ok(())
    }

    /// Search the index
    pub fn search(&self, query_str: &str, max_results: usize) -> Result<Vec<SearchResult>> {
        let reader = self.index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        let searcher = reader.searcher();
        let query_parser = QueryParser::for_index(
            &self.index,
            vec![self.title_field, self.body_field, self.tags_field],
        );

        let query = query_parser.parse_query(query_str)?;
        let top_docs = searcher.search(&query, &TopDocs::with_limit(max_results))?;

        let mut results = Vec::new();
        for (score, doc_address) in top_docs {
            let doc: TantivyDocument = searcher.doc(doc_address)?;
            let path = doc
                .get_first(self.path_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let title = doc
                .get_first(self.title_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let body = doc
                .get_first(self.body_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            // Create a snippet from body
            let snippet = if body.len() > 200 {
                format!("{}...", &body[..200])
            } else {
                body
            };

            results.push(SearchResult {
                path,
                title,
                snippet,
                score,
            });
        }

        Ok(results)
    }
}
