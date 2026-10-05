/**
 * Renders a schema.org JSON-LD block. `<` is escaped so string content (e.g. a
 * CMS title) can never close the script tag. JSON-LD isn't executed, so it is
 * unaffected by the page's script-src CSP.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
