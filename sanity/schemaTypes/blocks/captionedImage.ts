import { defineType, defineField } from 'sanity'

/** An image with required alt text and an optional caption. */
export const captionedImage = defineType({
  name: 'captionedImage',
  title: 'Image',
  type: 'image',
  options: { hotspot: true },
  fields: [
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      description: 'Describe the image for screen readers and SEO.',
      validation: (r) => r.required(),
    }),
    defineField({ name: 'caption', title: 'Caption', type: 'string' }),
  ],
  preview: {
    select: { media: 'asset', title: 'caption', alt: 'alt' },
    prepare: ({ media, title, alt }) => ({ media, title: title || alt || 'Image' }),
  },
})
