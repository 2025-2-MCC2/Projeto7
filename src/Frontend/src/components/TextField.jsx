import React from 'react';

export default function TextField({ iconLeft, iconRight, ...rest }) {
    return (
        <div className="text-field">
            {/* Agora, o componente simplesmente renderiza os ícones que recebe, sem adicionar formatação extra. */}
            {iconLeft}
            <input {...rest} />
            {iconRight}
        </div>
    );
}

