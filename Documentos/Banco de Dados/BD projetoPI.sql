CREATE DATABASE projetoPI;
USE projetoPI;

CREATE TABLE grupo (
    ID_grupo INT PRIMARY KEY AUTO_INCREMENT,
    nome_grupo VARCHAR(50) UNIQUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mentor VARCHAR(50) UNIQUE
);

CREATE TABLE usuario (
    ID_usuario INT PRIMARY KEY AUTO_INCREMENT,
    RA INT UNIQUE,
    nome_usuario VARCHAR(50),
    email VARCHAR(50) UNIQUE,
    senha VARCHAR(50),
    cargo VARCHAR(10),
    ID_grupo INT,
    FOREIGN KEY (ID_grupo)
        REFERENCES grupo (ID_grupo)
);

CREATE TABLE metas (
    ID_metas INT PRIMARY KEY AUTO_INCREMENT,
    descricao VARCHAR(100),
    valor_esperado FLOAT,
    meta_data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    meta_data_final DATE,
    status VARCHAR(25),
    ID_grupo INT NOT NULL,
    FOREIGN KEY (ID_grupo)
        REFERENCES grupo (ID_grupo)
);

CREATE TABLE relatorio (
    ID_relatorio INT PRIMARY KEY AUTO_INCREMENT,
    periodo_inicio DATE,
    periodo_fim DATE,
    relatorio_data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ID_grupo INT NOT NULL,
    FOREIGN KEY (ID_grupo)
        REFERENCES grupo (ID_grupo)
);

CREATE TABLE postagem (
    ID_postagem INT PRIMARY KEY AUTO_INCREMENT,
    conteudo VARCHAR(255),
    postagem_data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_postagem VARCHAR(255),
    ID_usuario INT NOT NULL,
    FOREIGN KEY (ID_usuario)
        REFERENCES usuario (ID_usuario)
);

CREATE TABLE doacao (
    ID_doacao INT PRIMARY KEY AUTO_INCREMENT,
    descricao VARCHAR(100),
    doacao_data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ID_postagem INT NOT NULL,
    FOREIGN KEY (ID_postagem)
        REFERENCES postagem (ID_postagem)
);

CREATE TABLE doacao_dinheiro (
    ID_doacao INT PRIMARY KEY NOT NULL,
    valor_doacao FLOAT,
    FOREIGN KEY (ID_doacao)
        REFERENCES doacao (ID_doacao)
);

CREATE TABLE doacao_item (
    ID_doacao INT PRIMARY KEY NOT NULL,
    item_doacao VARCHAR(50),
    quantidade FLOAT,
    unidade INT,
    FOREIGN KEY (ID_doacao)
        REFERENCES doacao (ID_doacao)
);

CREATE TABLE arquivo (
    ID_arquivo INT PRIMARY KEY AUTO_INCREMENT,
    tipo_arquivo VARCHAR(25),
    nome_arquivo VARCHAR(255),
    ID_doacao INT NOT NULL,
    ID_postagem INT NOT NULL,
    FOREIGN KEY (ID_doacao)
        REFERENCES doacao (ID_doacao),
    FOREIGN KEY (ID_postagem)
        REFERENCES postagem (ID_postagem)
);
