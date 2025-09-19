import React, { useState } from 'react';
import TextField from './TextField';

export default function PasswordField({ isPassword, ...props }) {
    const [show, setShow] = useState(false);

    // O ícone da esquerda (usuário ou cadeado) é criado como um elemento completo.
    const leftIcon = (
        <span className="icon">
            {isPassword ? '🔒' : '👤'}
        </span>
    );

    // O botão de ver/ocultar senha é criado apenas se for um campo de senha.
    const rightIcon = isPassword ? (
        <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)}>
            {/* O ícone muda para indicar a ação: 👁️ para ver, 🙈 para ocultar */}
            {show ? '🙈' : '👁️'}
        </button>
    ) : null;

    return (
        <TextField
            {...props}
            // A lógica para alternar o tipo do campo foi restaurada.
            type={isPassword ? (show ? 'text' : 'password') : (props.type || 'text')}
            iconLeft={leftIcon}
            iconRight={rightIcon}
        />
    );
}

