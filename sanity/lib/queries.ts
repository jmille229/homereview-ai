// GROQ queries for Learn content. Plain strings (no `groq` tag needed).

const LIST_FIELDS = `
  "slug": slug.current,
  title,
  category,
  summary,
  readTime,
  featured,
  publishedAt,
  coverImage
`

/** All published articles, newest first, for the /learn index. */
export const ARTICLES_QUERY = `*[_type == "article" && defined(slug.current)] | order(publishedAt desc) {${LIST_FIELDS}}`

/** A single article by slug, including the full rich-text body. */
export const ARTICLE_QUERY = `*[_type == "article" && slug.current == $slug][0] {
  ${LIST_FIELDS},
  seoTitle,
  seoDescription,
  body
}`

/** Just the slugs — for generateStaticParams. */
export const ARTICLE_SLUGS_QUERY = `*[_type == "article" && defined(slug.current)].slug.current`
