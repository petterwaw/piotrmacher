import { Barlow_Condensed } from 'next/font/google'

// Condensed grotesque for display lines and scorelines only: the voice of
// team sheets, kit numbers and broadcast score bugs. It keeps long headings
// on two lines at 375px, pairs with the heavy italic PIOTRMACHER wordmark,
// and has tabular lining figures for scores. Body copy stays Arial.
export const displayFont = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '800'],
  style: ['normal', 'italic'],
  display: 'swap',
  fallback: ['Arial Narrow', 'Arial', 'sans-serif'],
})
