import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { serviceAuth, AuthenticatedRequest } from '../middleware/serviceAuth';
import { mediaCache } from '../config/cache';
import { MediaFile } from '../interfaces/MediaFile';
import { MediaRepository } from '../repositories/MediaRepository';

const router = Router();

/**
 * List of allowed MIME types for file uploads
 */
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime', // .mov files
    'video/x-msvideo', // .avi files
    'video/x-ms-wmv',  // .wmv files
    'video/webm'       // .webm files
];

/**
 * Multer storage configuration
 * Files are stored with format: {entityId}-{position}{extension}
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log('Processing file upload - destination');
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        console.log('Processing file upload - filename', {
            body: req.body,
            file: file
        });
        const entityId = req.body.entityId || uuidv4();
        const position = req.body.position || 0;
        const ext = path.extname(file.originalname);
        cb(null, `${entityId}-${position}${ext}`);
    }
});

/**
 * File filter for multer
 * Validates file types against allowed MIME types
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    console.log('File filter check:', {
        mimetype: file.mimetype,
        allowed: ALLOWED_MIME_TYPES.includes(file.mimetype)
    });
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
    }
});

// Add logging middleware for all routes
router.use((req, res, next) => {
    console.log('\n=== MEDIA ROUTE REQUEST START ===');
    console.log('Media Route Request:', {
        method: req.method,
        path: req.path,
        url: req.url,
        baseUrl: req.baseUrl,
        originalUrl: req.originalUrl,
        query: req.query,
        params: req.params,
        headers: {
            'x-api-key': req.headers['x-api-key'] ? 'present' : 'missing',
            'x-service-name': req.headers['x-service-name'],
            'content-type': req.headers['content-type']
        }
    });
    next();
});

/**
 * Upload media files
 * @route POST /api/media/upload
 */
router.post('/upload',
    (req, res, next) => {
        console.log('Upload request received:', {
            headers: req.headers,
            body: req.body
        });
        next();
    },
    serviceAuth(),
    (req, res, next) => {
        console.log('Service authenticated, processing upload');
        next();
    },
    upload.array('files'),
    async (req: AuthenticatedRequest, res) => {
        console.log('POST /upload called:', {
            files: req.files?.length || 0,
            body: req.body,
            service: req.service
        });

        try {
            console.log('Processing upload request:', {
                files: req.files,
                body: req.body
            });

            const files = req.files as Express.Multer.File[];
            const entityId = req.body.entityId;
            const entityType = req.body.entityType;
            const companyId = req.body.companyId;

            if (!files || files.length === 0) {
                console.error('No files received in request');
                return res.status(400).json({ error: 'No files uploaded' });
            }

            if (!entityId || !entityType || !companyId) {
                console.error('Missing required fields:', { entityId, entityType, companyId });
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const mediaFiles = await Promise.all(files.map(async (file, index) => {
                const mediaFile: MediaFile = {
                    id: uuidv4(),
                    entityId,
                    entityType,
                    companyId,
                    filename: file.filename,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    position: index,
                    createdAt: new Date(),
                    path: file.path
                };

                // Cache the file metadata
                mediaCache.set(`${entityId}-${index}`, mediaFile);
                return mediaFile;
            }));

            // Create or update the consolidated metadata JSON file
            const metadataPath = path.join(__dirname, '../../uploads', `${entityId}.json`);
            let existingMetadata: MediaFile[] = [];

            // Try to read existing metadata file
            try {
                if (fs.existsSync(metadataPath)) {
                    existingMetadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
                }
            } catch (error) {
                console.warn('Error reading existing metadata:', error);
            }

            // Combine existing and new metadata, removing duplicates by position
            const combinedMetadata = [...existingMetadata, ...mediaFiles]
                .reduce((acc: MediaFile[], curr) => {
                    const index = acc.findIndex(item => item.position === curr.position);
                    if (index >= 0) {
                        acc[index] = curr; // Replace existing item
                    } else {
                        acc.push(curr); // Add new item
                    }
                    return acc;
                }, [])
                .sort((a, b) => a.position - b.position);

            // Write the consolidated metadata
            await fs.promises.writeFile(
                metadataPath,
                JSON.stringify(combinedMetadata, null, 2)
            );

            console.log('Upload successful:', {
                fileCount: mediaFiles.length,
                files: mediaFiles
            });

            res.json(mediaFiles);
        } catch (error) {
            console.error('Error in POST /upload:', error);
            res.status(500).json({ error: 'Failed to process upload' });
        }
    }
);

/**
 * Get media files by entity ID
 * @route GET /api/media/entity/:entityId
 * @param entityId - ID of the entity to get files for
 * @param companyId - ID of the company requesting the files
 */
router.get('/entity/:entityId',
    (req, res, next) => {
        console.log('Route handler middleware triggered');
        next();
    },
    serviceAuth(),
    async (req: AuthenticatedRequest, res) => {
        console.log('\n=== GET /entity/:entityId START ===');
        try {
            const { entityId } = req.params;
            console.log('Fetching files for entityId:', entityId);

            const uploadDir = path.join(__dirname, '../../uploads');
            const metadataPath = path.join(uploadDir, `${entityId}.json`);

            if (!fs.existsSync(metadataPath)) {
                console.log('No metadata file found for entityId:', entityId);
                return res.json([]);
            }

            // Read metadata file
            const metadata: MediaFile[] = JSON.parse(
                await fs.promises.readFile(metadataPath, 'utf8')
            );

            // Transform metadata into response format
            const fileDetails = metadata.map(file => ({
                id: file.id,
                filename: file.filename,
                originalName: file.originalName,
                mimeType: file.mimeType,
                url: `/media/file/${file.filename}`,
                position: file.position
            }));

            // Sort by position
            fileDetails.sort((a, b) => a.position - b.position);

            console.log('\nFinal response:', fileDetails);
            console.log('=== GET /entity/:entityId END ===\n');

            res.json(fileDetails);
        } catch (error) {
            console.error('\nError in GET /entity/:entityId:', error);
            console.log('=== GET /entity/:entityId ERROR END ===\n');
            res.status(500).json({ error: 'Failed to fetch media files' });
        }
    }
);

/**
 * Serve media file
 * @route GET /api/media/file/:filename
 * @param filename - Name of the file to serve
 */
router.get('/file/:filename', async (req: AuthenticatedRequest, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, '../../uploads', filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Set Cache-Control header for better performance
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        res.setHeader('Access-Control-Allow-Origin', '*');

        res.sendFile(filePath);
    } catch (error) {
        console.error('File serve error:', error);
        res.status(500).json({ error: 'Failed to serve file' });
    }
});

/**
 * Delete media file
 * @route DELETE /api/media/:entityId/:position
 * @param entityId - ID of the entity the file belongs to
 * @param position - Position of the file in the entity's media collection
 * @param companyId - ID of the company requesting deletion
 */
router.delete('/:entityId/:position',
    serviceAuth(),
    async (req: AuthenticatedRequest, res) => {
        try {
            const { entityId, position } = req.params;
            const companyId = req.query.companyId as string;

            if (!companyId) {
                return res.status(400).json({ error: 'Company ID is required' });
            }

            const cacheKey = `${entityId}-${position}`;
            const mediaFile = mediaCache.get(cacheKey) as MediaFile;

            if (mediaFile && mediaFile.companyId !== companyId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            // Delete file from filesystem
            const uploadDir = path.join(__dirname, '../../uploads');
            const files = fs.readdirSync(uploadDir)
                .filter(file => file.startsWith(`${entityId}-${position}`));

            files.forEach(file => {
                const filePath = path.join(uploadDir, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });

            // Remove from cache
            mediaCache.del(cacheKey);

            res.json({ message: 'Media deleted successfully' });
        } catch (error) {
            console.error('Delete error:', error);
            res.status(500).json({ error: 'Failed to delete file' });
        }
    }
);

/**
 * Simplify the storage config to just use a temp name
 */
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/logos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Just use a temp name initially
        const ext = path.extname(file.originalname);
        cb(null, `temp-${Date.now()}${ext}`);
    }
});

const logoUpload = multer({
    storage: logoStorage,
    fileFilter: (req, file, cb) => {
        console.log('File filter running:', {
            body: req.body,
            file: file.originalname
        });
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}`));
        }
    }
});

/**
 * Upload company logo
 * @route POST /api/media/company-logo
 */
router.post('/company-logo',
    serviceAuth(),
    logoUpload.single('file'),
    async (req: AuthenticatedRequest, res) => {
        console.log('POST /company-logo called:', {
            file: req.file,
            body: req.body,
            service: req.service
        });

        try {
            const file = req.file;
            const companyId = req.body.companyId;

            if (!file) {
                console.error('No file received in request');
                return res.status(400).json({ error: 'No file uploaded' });
            }

            if (!companyId) {
                console.error('Missing company ID');
                return res.status(400).json({ error: 'Company ID is required' });
            }

            // Create the final filename
            const ext = path.extname(file.originalname);
            const newFilename = `logo-${companyId}${ext}`;
            const newPath = path.join(path.dirname(file.path), newFilename);

            // Delete any existing logo file
            const uploadDir = path.join(__dirname, '../../uploads/logos');
            const existingFiles = fs.readdirSync(uploadDir)
                .filter(filename => filename.startsWith(`logo-${companyId}`));

            for (const existingFile of existingFiles) {
                const filePath = path.join(uploadDir, existingFile);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            // Rename the temp file to the final name
            fs.renameSync(file.path, newPath);

            const mediaFile = {
                id: uuidv4(),
                entityId: companyId,
                entityType: 'company-logo',
                companyId: companyId,
                filename: newFilename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: newPath,
                createdAt: new Date()
            };

            // Cache the file metadata
            mediaCache.set(`company-logo-${companyId}`, mediaFile);

            // Create metadata JSON file
            const metadataPath = path.join(__dirname, '../../uploads/logos', `logo-${companyId}.json`);
            await fs.promises.writeFile(
                metadataPath,
                JSON.stringify(mediaFile, null, 2)
            );

            console.log('Company logo upload successful:', mediaFile);

            res.json(mediaFile);
        } catch (error) {
            console.error('Error in POST /company-logo:', error);
            res.status(500).json({ error: 'Failed to process company logo upload' });
        }
    }
);

/**
 * Get company logo
 * @route GET /api/media/company-logo/:companyId
 */
router.get('/company-logo/:companyId',
    serviceAuth(),
    async (req: AuthenticatedRequest, res) => {
        console.log('GET /company-logo/:companyId called:', {
            params: req.params,
            service: req.service
        });

        try {
            const { companyId } = req.params;

            if (!companyId) {
                return res.status(400).json({ error: 'Company ID is required' });
            }

            // Check for existing logo
            const uploadDir = path.join(__dirname, '../../uploads/logos');
            const files = fs.readdirSync(uploadDir)
                .filter(filename => filename.startsWith(`logo-${companyId}`) && !filename.endsWith('.json'));

            if (files.length === 0) {
                return res.status(404).json({ error: 'Logo not found' });
            }

            const logoFile = files[0]; // Get the first (and should be only) matching file
            const logoPath = path.join(uploadDir, logoFile);

            // Read metadata
            const metadataPath = path.join(uploadDir, `logo-${companyId}.json`);
            let metadata = null;

            if (fs.existsSync(metadataPath)) {
                metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
            }

            // Set Cache-Control header for better performance
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
            res.setHeader('Access-Control-Allow-Origin', '*');

            if (req.query.metadata === 'true') {
                // Return metadata if requested
                return res.json({
                    ...metadata,
                    url: `/api/media/company-logo/${companyId}/file`
                });
            }

            // Otherwise serve the file
            res.sendFile(logoPath);

        } catch (error) {
            console.error('Error in GET /company-logo/:companyId:', error);
            res.status(500).json({ error: 'Failed to retrieve company logo' });
        }
    }
);

/**
 * Get company logo file
 * @route GET /api/media/company-logo/:companyId/file
 */
router.get('/company-logo/file/:companyId',
    async (req, res) => {
        try {
            console.log("HIT2")
            const companyId = req.params.companyId.split('.')[0]; // Extract base ID without extension
            const uploadDir = path.join(__dirname, '../../uploads/logos');
            const files = fs.readdirSync(uploadDir)
                .filter(filename => filename.startsWith(`logo-${companyId}`) && !filename.endsWith('.json'));

            if (files.length === 0) {
                return res.status(404).json({ error: 'Logo not found' });
            }

            // Sort files by creation time and get the most recent one
            const logoFile = files
                .map(file => ({
                    name: file,
                    time: fs.statSync(path.join(uploadDir, file)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time)[0].name;

            const logoPath = path.join(uploadDir, logoFile);

            // Set Cache-Control header for better performance
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
            res.setHeader('Access-Control-Allow-Origin', '*');

            res.sendFile(logoPath);
        } catch (error) {
            console.error('Error serving logo file:', error);
            res.status(500).json({ error: 'Failed to serve logo file' });
        }
    }
);

export default router;