import { defineType, defineField } from 'sanity'
import { isSafeLinkHref } from '../lib/href'

const CATEGORIES = ['HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Foundation', 'Appliances', 'Pest', 'Maintenance', 'Hiring', 'General']

/** A Learn article. Its `body` is rich text with the custom blocks mixed in. */
export const article = defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      description: 'The URL path: /learn/<slug>.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: { list: CATEGORIES.map((c) => ({ title: c, value: c })) },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'summary',
      title: 'Summary',
      type: 'text',
      rows: 3,
      description: 'Shown on the Learn index and used as the meta description.',
      validation: (r) => r.required().max(300),
    }),
    defineField({ name: 'readTime', title: 'Read time', type: 'string', description: 'e.g. "6 min"', initialValue: '5 min' }),
    defineField({ name: 'publishedAt', title: 'Published date', type: 'datetime', validation: (r) => r.required(), initialValue: () => new Date().toISOString() }),
    defineField({ name: 'featured', title: 'Featured?', type: 'boolean', description: 'Show in the Featured section on the Learn index.', initialValue: false }),
    defineField({
      name: 'coverImage',
      title: 'Cover image (optional)',
      type: 'image',
      options: { hotspot: true },
      fields: [defineField({ name: 'alt', title: 'Alt text', type: 'string' })],
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [
        {
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'Heading', value: 'h2' },
            { title: 'Subheading', value: 'h3' },
            { title: 'Quote', value: 'blockquote' },
          ],
          lists: [
            { title: 'Bullet', value: 'bullet' },
            { title: 'Numbered', value: 'number' },
          ],
          marks: {
            decorators: [
              { title: 'Bold', value: 'strong' },
              { title: 'Italic', value: 'em' },
            ],
            annotations: [
              {
                name: 'link',
                title: 'Link',
                type: 'object',
                fields: [{
                  name: 'href', title: 'URL', type: 'string',
                  validation: (r) => r.required().custom((v: string | undefined) =>
                    !v || isSafeLinkHref(v) ? true : 'Use a path starting with / or an http(s)/mailto/tel URL.'),
                }],
              },
            ],
          },
        },
        { type: 'callout' },
        { type: 'captionedImage' },
        { type: 'comparisonTable' },
        { type: 'ctaBlock' },
        { type: 'pullQuote' },
      ],
      validation: (r) => r.required(),
    }),
    defineField({ name: 'seoTitle', title: 'SEO title (optional)', type: 'string', description: 'Overrides the page <title>. Defaults to the article title.' }),
    defineField({ name: 'seoDescription', title: 'SEO description (optional)', type: 'text', rows: 2, description: 'Overrides the meta description. Defaults to the summary.' }),
  ],
  orderings: [{ title: 'Published, newest', name: 'publishedDesc', by: [{ field: 'publishedAt', direction: 'desc' }] }],
  preview: {
    select: { title: 'title', subtitle: 'category', media: 'coverImage' },
  },
})
