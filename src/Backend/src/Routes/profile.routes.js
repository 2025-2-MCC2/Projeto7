// src/Backend/src/routes/profile.routes.js
import { Router } from 'express';
import { uploadPhoto, linkPhoto, removePhoto } from '../controllers/profileController.js';
import { makeProfileUpload } from '../middlewares/upload.js';

const router = Router();
const upload = makeProfileUpload();

// =======================================================
// Rota de Upload (POST /api/profile/upload)
// Esta rota está correta.
// =======================================================
// multipart/form-data (campo "photo") + body.userId
router.post('/upload', upload, uploadPhoto);


// body: { userId, url }
router.post('/link', linkPhoto);

// body: { userId }
router.post('/remove', removePhoto);

export default router;

