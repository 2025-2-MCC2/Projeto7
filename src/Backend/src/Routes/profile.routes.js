// src/Backend/src/routes/profile.routes.js
import { Router } from 'express';
import { uploadPhoto, linkPhoto, removePhoto } from '../controllers/profileController.js';
import { makeProfileUpload } from '../middleware/upload.js';

const router = Router();
const upload = makeProfileUpload();

// multipart/form-data (campo "photo") + body.userId
router.post('/photo', upload, uploadPhoto);

// body: { userId, url }
router.post('/photo-link', linkPhoto);

// body: { userId }
router.delete('/photo', removePhoto);

export default router;