CREATE DATABASE projetoPI;
USE projetoPI;

CREATE TABLE grupo (
    ID_grupo INT PRIMARY KEY AUTO_INCREMENT,
    nome_grupo VARCHAR(50) UNIQUE NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    mentor VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE usuario (
    ID_usuario INT PRIMARY KEY AUTO_INCREMENT,
    RA INT UNIQUE NOT NULL,
    nome_usuario VARCHAR(50) NOT NULL,
    email VARCHAR(50) UNIQUE NOT NULL,
    senha VARCHAR(50) NOT NULL,
    cargo VARCHAR(10) NOT NULL,
    ID_grupo INT,
    FOREIGN KEY (ID_grupo)
        REFERENCES grupo (ID_grupo)
);

CREATE TABLE metas (
    ID_metas INT PRIMARY KEY AUTO_INCREMENT,
    descricao VARCHAR(100),
    valor_esperado FLOAT NOT NULL,
    meta_data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    meta_data_final DATE NOT NULL,
    status VARCHAR(25),
    ID_grupo INT NOT NULL,
    FOREIGN KEY (ID_grupo)
        REFERENCES grupo (ID_grupo)
);

CREATE TABLE relatorio (
    ID_relatorio INT PRIMARY KEY AUTO_INCREMENT,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    relatorio_data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ID_grupo INT NOT NULL,
    FOREIGN KEY (ID_grupo)
        REFERENCES grupo (ID_grupo)
);

CREATE TABLE postagem (
    ID_postagem INT PRIMARY KEY AUTO_INCREMENT,
    conteudo VARCHAR(255) NOT NULL,
    postagem_data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tipo_postagem VARCHAR(255) NOT NULL,
    ID_usuario INT NOT NULL,
    FOREIGN KEY (ID_usuario)
        REFERENCES usuario (ID_usuario)
);

CREATE TABLE doacao (
    ID_doacao INT PRIMARY KEY AUTO_INCREMENT,
    descricao VARCHAR(100) NOT NULL,
    doacao_data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ID_postagem INT NOT NULL,
    FOREIGN KEY (ID_postagem)
        REFERENCES postagem (ID_postagem)
);

CREATE TABLE doacao_dinheiro (
    ID_doacao INT PRIMARY KEY NOT NULL,
    valor_doacao FLOAT NOT NULL,
    FOREIGN KEY (ID_doacao)
        REFERENCES doacao (ID_doacao)
);

CREATE TABLE doacao_item (
    ID_doacao INT PRIMARY KEY NOT NULL,
    item_doacao VARCHAR(50) NOT NULL,
    quantidade FLOAT NOT NULL,
    unidade INT NOT NULL,
    FOREIGN KEY (ID_doacao)
        REFERENCES doacao (ID_doacao)
);

CREATE TABLE arquivo (
    ID_arquivo INT PRIMARY KEY AUTO_INCREMENT,
    tipo_arquivo VARCHAR(25) NOT NULL,
    caminho_arquivo VARCHAR(255) NOT NULL,
    ID_doacao INT NOT NULL,
    ID_postagem INT NOT NULL,
    FOREIGN KEY (ID_doacao)
        REFERENCES doacao (ID_doacao),
    FOREIGN KEY (ID_postagem)
        REFERENCES postagem (ID_postagem)
);

