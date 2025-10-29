import { Router } from "express";

import {
  getGrupos,
  getGrupoById,
  createGrupo,
  updateGrupo,
  deleteGrupo,
} from "../controllers/grupoController.js";


import {
  getMetas,
  getMetaById,
  createMeta,
  updateMeta,
  deleteMeta,
} from "../controllers/metasController.js";

import {
  getRelatorios,
  getRelatorioById,
  createRelatorio,
  updateRelatorio,
  deleteRelatorio,
} from "../controllers/relatorioController.js";

import {
  getPostagens,
  getPostagemById,
  createPostagem,
  updatePostagem,
  deletePostagem,
} from "../controllers/postagemController.js";


import {
   listDoacoesByGrupo,
   getDoacao,
   createDoacao,
   updateDoacao,
   approveDoacao,
   rejectDoacao,
   deleteDoacao,
} from "../controllers/doacaoController.js";


import {
  getDoacoesDinheiro,
  getDoacaoDinheiroById,
  createDoacaoDinheiro,
  updateDoacaoDinheiro,
  deleteDoacaoDinheiro,
} from "../controllers/doacaoDinheiroController.js";

import {
  getDoacoesItem,
  getDoacaoItemById,
  createDoacaoItem,
  updateDoacaoItem,
  deleteDoacaoItem,
} from "../controllers/doacaoItemController.js";

import {
  getArquivos,
  getArquivoById,
  createArquivo,
  updateArquivo,
  deleteArquivo,
} from "../controllers/arquivoController.js";

const r = Router();

// Grupos
r.get("/grupos/:grupoId/doacoes", listDoacoesByGrupo);
r.get("/grupos/:grupoId/doacoes/:id", getDoacao);
r.post("/grupos/:grupoId/doacoes", createDoacao);
r.put("/grupos/:grupoId/doacoes/:id", updateDoacao);
r.put("/grupos/:grupoId/doacoes/:id/aprovar", approveDoacao);
r.put("/grupos/:grupoId/doacoes/:id/rejeitar", rejectDoacao);
r.delete("/grupos/:grupoId/doacoes/:id", deleteDoacao)

r.get("/grupos", getGrupos);          // <--- Rota GET /api/grupos (a que estava faltando)
r.get("/grupos/:id", getGrupoById);   // <--- Rota GET /api/grupos/:id
r.post("/grupos", createGrupo);       // <--- Rota POST /api/grupos
r.put("/grupos/:id", updateGrupo);    // <--- Rota PUT /api/grupos/:id
r.delete("/grupos/:id", deleteGrupo); // <--- Rota DELETE /api/grupos/:id


// Metas
r.get("/metas", getMetas);
r.get("/metas/:id", getMetaById);
r.post("/metas", createMeta);
r.put("/metas/:id", updateMeta);
r.delete("/metas/:id", deleteMeta);

// Relatórios
r.get("/relatorios", getRelatorios);
r.get("/relatorios/:id", getRelatorioById);
r.post("/relatorios", createRelatorio);
r.put("/relatorios/:id", updateRelatorio);
r.delete("/relatorios/:id", deleteRelatorio);

// Postagens
r.get("/postagens", getPostagens);
r.get("/postagens/:id", getPostagemById);
r.post("/postagens", createPostagem);
r.put("/postagens/:id", updatePostagem);
r.delete("/postagens/:id", deletePostagem);

// Doações

r.get("/grupos/:grupoId/doacoes", listDoacoesByGrupo);
r.get("/grupos/:grupoId/doacoes/:id", getDoacao);
r.post("/grupos/:grupoId/doacoes", createDoacao);
r.put("/grupos/:grupoId/doacoes/:id", updateDoacao);
r.put("/grupos/:grupoId/doacoes/:id/aprovar", approveDoacao);
r.put("/grupos/:grupoId/doacoes/:id/rejeitar", rejectDoacao);
r.delete("/grupos/:grupoId/doacoes/:id", deleteDoacao);


// Doações Dinheiro
r.get("/doacoes-dinheiro", getDoacoesDinheiro);
r.get("/doacoes-dinheiro/:id", getDoacaoDinheiroById);
r.post("/doacoes-dinheiro", createDoacaoDinheiro);
r.put("/doacoes-dinheiro/:id", updateDoacaoDinheiro);
r.delete("/doacoes-dinheiro/:id", deleteDoacaoDinheiro);

// Doações Item
r.get("/doacoes-item", getDoacoesItem);
r.get("/doacoes-item/:id", getDoacaoItemById);
r.post("/doacoes-item", createDoacaoItem);
r.put("/doacoes-item/:id", updateDoacaoItem);
r.delete("/doacoes-item/:id", deleteDoacaoItem);

// Arquivos
r.get("/arquivos", getArquivos);
r.get("/arquivos/:id", getArquivoById);
r.post("/arquivos", createArquivo);
r.put("/arquivos/:id", updateArquivo);
r.delete("/arquivos/:id", deleteArquivo);

export default r;
