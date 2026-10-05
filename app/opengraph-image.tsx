import { OG_SIZE, renderOgImage } from '@/lib/og'

export const alt = 'HomeReview AI: never face a contractor unprepared'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return renderOgImage({
    eyebrow:  'Independent home repair advisor',
    title:    'Never face a contractor unprepared.',
    subtitle: 'Understand the problem, know the fair price, and check your quote before you sign.',
  })
}
