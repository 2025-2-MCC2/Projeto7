import fs from 'fs/promises';
import path from 'node:path';

// Define o diretório de uploads (relativo ao CWD, diretório onde o 'node' foi iniciado)
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const GRUPOS_DIR = path.join(UPLOADS_DIR, 'grupos');
const PUBLIC_URL_PREFIX = '/uploads/grupos';

// *** NOVO ***
// Lê a URL pública do backend a partir das variáveis de ambiente
// Certifique-se de definir MYSQL_PUBLIC_URL no seu ficheiro .env
const BACKEND_URL = ('https://projeto-interdisciplinar-2.onrender.com' || 'http://localhost:3000').replace(/\/$/, '');


/**
 * Garante que o diretório de uploads de grupos exista.
 */
async function ensureUploadsDir() {
  try {
    await fs.mkdir(GRUPOS_DIR, { recursive: true });
  } catch (err) {
    console.error(`[fileUtils] Falha ao criar diretório ${GRUPOS_DIR}:`, err);
    throw new Error('Falha ao preparar diretório de upload.');
  }
}

/**
 * Converte uma string base64 (data:image/png;base64,...) em um arquivo de imagem
 * e o salva no diretório de uploads de grupos.
 * Se a string não for base64 (ex: uma URL http://... ou nula), ela é retornada como está.
 * * @param {string} dataString A string base64 completa (com o prefixo) OU uma URL existente.
 * @param {string} baseFileName O nome base do arquivo (ex: 'capa_grupo_123')
 * @returns {Promise<string>} A URL pública e ABSOLUTA para o arquivo salvo (ex: http://...) ou a string original.
 */
export async function saveBase64AsFile(dataString, baseFileName) {
  // --- CORREÇÃO ---
  // 1. Verifica se é uma string base64 válida (uma *nova* imagem)
  if (!dataString || !dataString.startsWith('data:image/')) {
    // Se NÃO for base64 (ex: é uma URL http://... ou /uploads/...)
    // ou se for nulo/vazio, apenas retorne o valor original sem erro.
    return dataString;
  }
  
  // Se chegamos aqui, é um NOVO UPLOAD de base64 e precisa ser processado.

  // 2. Garante que o diretório exista
  await ensureUploadsDir();

  // 3. Extrai o tipo de imagem (png, jpeg, etc.) e os dados
  const matches = dataString.match(/^data:(image\/(\w+));base64,(.+)$/);
  if (!matches || matches.length !== 4) {
    // Este erro agora só deve acontecer se o base64 estiver corrompido
    throw new Error('Não foi possível decodificar a imagem base64.');
  }

  const imageType = matches[2]; // ex: "png"
  const base64Data = matches[3];
  const fileBuffer = Buffer.from(base64Data, 'base64');

  // 4. Define o nome e o caminho do arquivo
  // Remove caracteres inválidos do nome base
  const safeFileName = baseFileName.replace(/[^a-z0-9_-]/gi, '_'); 
  const fileName = `${safeFileName}_${Date.now()}.${imageType}`; // Adiciona timestamp para evitar cache
  const filePath = path.join(GRUPOS_DIR, fileName);

  // 5. Salva o arquivo no disco
  try {
    await fs.writeFile(filePath, fileBuffer);
  } catch (err) {
    console.error(`[fileUtils] Falha ao salvar arquivo ${filePath}:`, err);
    throw new Error('Falha ao salvar arquivo de imagem.');
  }

  // 6. Retorna a URL PÚBLICA e ABSOLUTA (que o frontend usará)
  const relativeUrl = `${PUBLIC_URL_PREFIX}/${fileName}`.replace(/\\/g, '/');
  
  // Constrói a URL absoluta (ex: http://localhost:3000/uploads/grupos/...)
  const publicUrl = `${BACKEND_URL}${relativeUrl}`;
  
  return publicUrl;
}

