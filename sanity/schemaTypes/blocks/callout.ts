import { defineType, defineField } from 'sanity'

/** A highlighted callout box — tip / red-flag / warning / info. */
export const callout = defineType({
  name: 'callout',
  title: 'Callout box',
  type: 'object',
  fields: [
    defineField({
      name: 'tone',
      title: 'Type',
      type: 'string',
      options: {
        layout: 'radio',
        list: [
          { title: '💡 Tip', value: 'tip' },
          { title: '🚩 Red flag', value: 'redflag' },
          { title: '⚠️ Warning', value: 'warning' },
          { title: 'ℹ️ Info', value: 'info' },
        ],
      },
      initialValue: 'tip',
      validation: (r) => r.required(),
    }),
    defineField({ name: 'title', title: 'Title (optional)', type: 'string' }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [{ type: 'block', styles: [{ title: 'Normal', value: 'normal' }], lists: [{ title: 'Bullet', value: 'bullet' }] }],
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: { title: 'title', tone: 'tone' },
    prepare: ({ title, tone }) => ({ title: title || 'Callout', subtitle: `Callout · ${tone ?? ''}` }),
  },
})
