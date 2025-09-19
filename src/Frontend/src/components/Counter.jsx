import React from 'react'

function useCountUp(target, duration = 1400) {
  const [value, setValue] = React.useState(0)
  const ref = React.useRef(null)
  const [started, setStarted] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started) {
            setStarted(true)
          }
        })
      },
      { threshold: 0.3 }
    )

    obs.observe(node)
    return () => obs.disconnect()
  }, [started])

  React.useEffect(() => {
    if (!started) return
    const start = performance.now()

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setValue(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }, [target, duration, started])

  return { value, ref }
}

export default function Counter({ value, locale = 'pt-BR' }) {
  const { value: current, ref } = useCountUp(value)
  const formatter = new Intl.NumberFormat(locale)
  return (
    <span ref={ref} aria-live="polite" aria-atomic="true">
      {formatter.format(current)}
    </span>
  )
}
