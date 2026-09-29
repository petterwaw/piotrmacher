import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Shared renderer for the Open Graph / Twitter cards and the app icons.
// `_og` is a private folder (not a route). Fonts: Arimo Bold Italic (Apache
// 2.0, metric twin of the Arial used by the header wordmark; subset to the
// letters of PIOTRMACHER) and Barlow Condensed (OFL, the landing display face).

export const OG_SIZE = { width: 1200, height: 630 }

const BRAND = '#2E7D32'
const BRAND_DEEP = '#1B5E20'
const BRIGHT = '#4CAF50'
const INK = '#0F1A12'
const MINT = '#C8E6C9'

const fontDir = join(process.cwd(), 'app/_og/fonts')

async function loadFonts() {
  const [wordmark, display, text] = await Promise.all([
    readFile(join(fontDir, 'Arimo-BoldItalic.ttf')),
    readFile(join(fontDir, 'BarlowCondensed-ExtraBoldItalic.ttf')),
    readFile(join(fontDir, 'BarlowCondensed-SemiBold.ttf')),
  ])
  return [
    { name: 'Wordmark', data: wordmark, weight: 700 as const, style: 'italic' as const },
    { name: 'Display', data: display, weight: 800 as const, style: 'italic' as const },
    { name: 'Text', data: text, weight: 600 as const, style: 'normal' as const },
  ]
}

type CardCopy = {
  eyebrow: string
  // First line white, the rest mint. Break lines by hand: ~14 chars fit.
  lines: string[]
  footer: string
}

export const LANDING_CARD: CardCopy = {
  eyebrow: 'Score predictions with friends',
  lines: ['Call the score.', 'Settle it', 'in the table.'],
  footer: 'Private rooms · 10 leagues and cups · points counted for you',
}

// Generic on purpose: shown for every /join/<code> link, whatever the room.
export const INVITE_CARD: CardCopy = {
  eyebrow: "You're invited",
  lines: ['Join my', 'prediction room.'],
  footer: 'Predict every match · see who tops the table',
}

function Pitch() {
  // Halfway line + centre circle, bleeding off the right edge.
  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 520, display: 'flex' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 250,
          width: 4,
          background: 'rgba(255,255,255,0.10)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 125,
          left: 62,
          width: 380,
          height: 380,
          borderRadius: 9999,
          border: '4px solid rgba(255,255,255,0.10)',
        }}
      />
    </div>
  )
}

function ScoreCard() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 300,
        background: '#FFFFFF',
        border: `4px solid ${INK}`,
        boxShadow: `14px 14px 0 ${BRAND_DEEP}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: INK,
          color: '#FFFFFF',
          fontFamily: 'Text',
          fontSize: 24,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        <span>Your call</span>
        <span style={{ color: BRIGHT }}>FT</span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 0 0',
          fontFamily: 'Display',
          fontSize: 150,
          lineHeight: 1,
          color: INK,
        }}
      >
        2:1
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          margin: '14px 18px 18px',
          padding: '8px 0',
          background: BRIGHT,
          color: '#FFFFFF',
          fontFamily: 'Display',
          fontSize: 40,
          lineHeight: 1,
        }}
      >
        +5 PTS
      </div>
    </div>
  )
}

export async function renderShareCard(copy: CardCopy) {
  const fonts = await loadFonts()

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          height: '100%',
          background: BRAND,
          color: '#FFFFFF',
          padding: '56px 64px',
        }}
      >
        <Pitch />
        {/* Bright stripe on the left edge, like a kit trim. */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: BRIGHT }} />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontFamily: 'Wordmark', fontSize: 64, lineHeight: 1, letterSpacing: -1.5 }}>
            PIOTRMACHER
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex' }}>
              <div
                style={{
                  display: 'flex',
                  padding: '6px 14px',
                  background: '#FFFFFF',
                  color: BRAND,
                  fontFamily: 'Text',
                  fontSize: 28,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                {copy.eyebrow}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginTop: 22,
                fontFamily: 'Display',
                fontSize: 108,
                lineHeight: 0.92,
                textTransform: 'uppercase',
              }}
            >
              {copy.lines.map((line, index) => (
                <span key={line} style={{ color: index === 0 ? '#FFFFFF' : MINT }}>
                  {line}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', fontFamily: 'Text', fontSize: 30, color: MINT }}>{copy.footer}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 24, paddingRight: 8 }}>
          <ScoreCard />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts }
  )
}

export async function renderIcon(size: number) {
  const fonts = await loadFonts()
  const stripe = Math.max(2, Math.round(size * 0.08))

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: BRAND,
          color: '#FFFFFF',
          fontFamily: 'Wordmark',
          fontSize: Math.round(size * 0.56),
          letterSpacing: -size * 0.02,
          lineHeight: 1,
        }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: stripe, background: BRIGHT }} />
        <span style={{ marginTop: -stripe }}>PM</span>
      </div>
    ),
    { width: size, height: size, fonts }
  )
}
