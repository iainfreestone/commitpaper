use std::collections::HashMap;
use comrak::Options;

/// Parse a markdown file and extract wikilinks and frontmatter
pub fn parse_note(content: &str) -> ParsedNote {
    let mut links = Vec::new();
    let mut tags = Vec::new();
    let mut frontmatter = HashMap::new();

    // Extract wikilinks using regex-like scanning
    // comrak's wikilink support parses [[target]] and [[target|label]]
    extract_wikilinks(content, &mut links);

    // Extract frontmatter
    extract_frontmatter(content, &mut frontmatter, &mut tags);

    // Extract inline tags (#tag)
    extract_inline_tags(content, &mut tags);

    ParsedNote {
        links,
        tags,
        frontmatter,
    }
}

#[derive(Debug, Clone)]
pub struct ParsedNote {
    pub links: Vec<String>,
    pub tags: Vec<String>,
    pub frontmatter: HashMap<String, String>,
}

/// Extract [[wikilinks]] from markdown content
fn extract_wikilinks(content: &str, links: &mut Vec<String>) {
    let mut chars = content.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '[' {
            if chars.peek() == Some(&'[') {
                chars.next(); // consume second [
                let mut link = String::new();
                let mut found_close = false;
                while let Some(&c2) = chars.peek() {
                    chars.next();
                    if c2 == ']' {
                        if chars.peek() == Some(&']') {
                            chars.next();
                            found_close = true;
                            break;
                        }
                    }
                    link.push(c2);
                }
                if found_close && !link.is_empty() {
                    // Handle [[target|display]] - extract just the target
                    let target = link.split('|').next().unwrap_or(&link).trim().to_string();
                    if !target.is_empty() {
                        links.push(target);
                    }
                }
            }
        }
    }
}

/// Extract YAML frontmatter from markdown content
fn extract_frontmatter(
    content: &str,
    frontmatter: &mut HashMap<String, String>,
    tags: &mut Vec<String>,
) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return;
    }

    let after_start = &trimmed[3..];
    if let Some(end_idx) = after_start.find("\n---") {
        let yaml_content = &after_start[..end_idx];
        for line in yaml_content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once(':') {
                let key = key.trim().to_string();
                let value = value.trim().to_string();

                if key == "tags" {
                    // Handle tags: [tag1, tag2] or tags:\n  - tag1
                    let tag_str = value.trim_start_matches('[').trim_end_matches(']');
                    for tag in tag_str.split(',') {
                        let tag = tag.trim().trim_matches('"').trim_matches('\'').to_string();
                        if !tag.is_empty() {
                            tags.push(tag);
                        }
                    }
                } else {
                    frontmatter.insert(key, value);
                }
            }
        }
    }
}

/// Extract inline #tags from content
fn extract_inline_tags(content: &str, tags: &mut Vec<String>) {
    // Skip frontmatter section
    let body = if content.trim_start().starts_with("---") {
        let trimmed = content.trim_start();
        let after = &trimmed[3..];
        if let Some(end) = after.find("\n---") {
            &after[end + 4..]
        } else {
            content
        }
    } else {
        content
    };

    for word in body.split_whitespace() {
        if word.starts_with('#') && word.len() > 1 {
            let tag = word
                .trim_start_matches('#')
                .trim_end_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_' && c != '/')
                .to_string();
            if !tag.is_empty() && !tags.contains(&tag) {
                tags.push(tag);
            }
        }
    }
}

/// Render markdown to HTML using comrak
pub fn render_to_html(content: &str) -> String {
    let mut options = Options::default();
    options.extension.strikethrough = true;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.extension.footnotes = true;
    options.extension.front_matter_delimiter = Some("---".to_string());
    options.render.unsafe_ = true;

    comrak::markdown_to_html(content, &options)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_wikilinks() {
        let content = "Hello [[World]] and [[Another Note|display]]";
        let parsed = parse_note(content);
        assert_eq!(parsed.links, vec!["World", "Another Note"]);
    }

    #[test]
    fn test_extract_frontmatter() {
        let content = "---\ntitle: My Note\ntags: [rust, tauri]\n---\n\nContent here";
        let parsed = parse_note(content);
        assert_eq!(parsed.frontmatter.get("title"), Some(&"My Note".to_string()));
        assert!(parsed.tags.contains(&"rust".to_string()));
        assert!(parsed.tags.contains(&"tauri".to_string()));
    }

    #[test]
    fn test_extract_inline_tags() {
        let content = "Hello #world and #rust-lang are great";
        let parsed = parse_note(content);
        assert!(parsed.tags.contains(&"world".to_string()));
        assert!(parsed.tags.contains(&"rust-lang".to_string()));
    }
}
