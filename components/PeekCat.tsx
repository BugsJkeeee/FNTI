'use client'

import { useEffect, useRef, useState } from 'react'
import { useTaskInserted } from '@/lib/hooks/useTaskInserted'

const STAY_VISIBLE_MS = 3_000

export default function PeekCat() {
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useTaskInserted(() => {
    setVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setVisible(false), STAY_VISIBLE_MS)
  })

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  return (
    <div className={`peek-cat${visible ? ' peek-cat--visible' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 180 170" role="presentation">
        <path
          d="M111 116c25-12 52-2 58 23 5 21-7 34-29 31h-48c-25 0-39-14-34-35 5-20 28-30 53-19Z"
          fill="#d8a565"
          stroke="#382b25"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M64 69 70 28l29 22c13-4 28-4 41 0l29-22 5 43c7 10 10 23 8 37-4 31-30 49-65 47-35 1-60-18-61-49-1-14 2-26 8-37Z"
          fill="#efbd7a"
          stroke="#382b25"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="m73 39 20 15-22 10 2-25ZM165 39l-20 15 22 10-2-25Z" fill="#ee8d8d" />
        <path d="M88 76c5-5 11-5 16 0M139 76c5-5 11-5 16 0" fill="none" stroke="#382b25" strokeWidth="5" strokeLinecap="round" />
        <path d="M116 88c4-4 10-4 14 0-2 6-12 6-14 0Z" fill="#d96f70" stroke="#382b25" strokeWidth="3" />
        <path d="M123 94c0 8-8 12-14 7M123 94c0 8 8 12 14 7" fill="none" stroke="#382b25" strokeWidth="3" strokeLinecap="round" />
        <path d="M72 91 43 85M72 101l-31 4M165 91l27-7M165 101l29 5" fill="none" stroke="#382b25" strokeWidth="3" strokeLinecap="round" />
        <path d="M103 56c5-5 11-8 17-8M137 49c5 2 10 5 14 10" fill="none" stroke="#c9894f" strokeWidth="5" strokeLinecap="round" />
        <g className="peek-cat__paw">
          <path
            d="M73 127c-12-3-21-12-22-25l-2-25c-1-11-10-19-20-17-11 2-16 11-13 22l8 34c5 21 23 35 43 34 12-1 18-20 6-23Z"
            fill="#efbd7a"
            stroke="#382b25"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path d="M20 72c5 6 11 7 18 3M26 62c4 6 9 8 16 5" fill="none" stroke="#c9894f" strokeWidth="3" strokeLinecap="round" />
        </g>
        <path d="M107 129c7 7 18 7 25 0" fill="none" stroke="#382b25" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span className="peek-cat__caption">мяу!</span>
    </div>
  )
}
