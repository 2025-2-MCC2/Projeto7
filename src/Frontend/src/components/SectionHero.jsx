import React from 'react'

export default function SectionHero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__inner">
        <h2 id="hero-title" className="hero__title">
          Resultados somados das últimas 6 edições
        </h2>
        <p className="hero__desc">
          Esses são os resultados somados das seis últimas edições. Para entender
          mais a fundo você pode acessar o relatório individual de cada edição,
          ou utilizar nosso dashboard interativo.
        </p>
      </div>
    </section>
  )
}
