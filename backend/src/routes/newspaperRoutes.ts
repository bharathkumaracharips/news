import { Router } from 'express';
import multer from 'multer';
import { uploadNewspaper, getNewspaperReport } from '../controllers/newspaperController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload a PDF newspaper
router.post('/upload', upload.single('pdf'), uploadNewspaper);

// Get the comparative AI report for a given date
router.get('/report', getNewspaperReport);

export default router;
