// src/components/MetricCard.jsx
import React from 'react'
import Counter from './Counter'

function NumberBlock({ kicker, value, unit }) {
  return (
    <div className="metric__number">
      {kicker && <div className="metric__kicker">{kicker}</div>}
      <div className="metric__value">
        <Counter value={value} />
        {unit ? ` ${unit}` : ''}
      </div>
    </div>
  )
}

export default function MetricCard({
  layout = 'leftText', // 'leftText' | 'rightText'
  bg = 'var(--green-700)',
  image,
  imageAlt,
  kicker,
  value,
  unit,
  subtitle
}) {
  const classes = ['metric', layout === 'rightText' ? 'metric--right' : ''].join(' ')
  return (
    <section className={classes} style={{ background: bg }}>
      <div className="metric__content">
        <NumberBlock kicker={kicker} value={value} unit={unit} />
        {subtitle && <p className="metric__subtitle">{subtitle}</p>}
      </div>

      <div className="metric__media">
        <img src={image} alt={imageAlt} loading="lazy" />
      </div>
    </section>
  )
}
