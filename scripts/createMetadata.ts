import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MediaFile } from '../src/interfaces/MediaFile';

const uploadsDir = path.join(__dirname, '../uploads');

async function createMetadata() {
    console.log('Starting metadata creation...');
    console.log('Uploads directory:', uploadsDir);

    const files = await fs.promises.readdir(uploadsDir);
    console.log('Found files:', files);

    for (const file of files) {
        if (file.endsWith('.json')) {
            console.log('Skipping JSON file:', file);
            continue;
        }

        console.log('\nProcessing file:', file);
        const filePath = path.join(uploadsDir, file);
        const stats = await fs.promises.stat(filePath);

        if (!stats.isFile()) {
            console.log('Skipping non-file:', file);
            continue;
        }

        // Extract the full UUID from the filename
        const parts = file.split('-');
        console.log('File parts:', parts);

        const fullEntityId = parts[0];  // Get the full UUID part
        const position = parts[1]?.split('.')[0] || '0';  // Get position before extension
        const positionNum = parseInt(position);

        console.log('Parsed values:', {
            fullEntityId,
            position,
            positionNum,
            originalFile: file
        });

        const mediaFile: MediaFile = {
            id: uuidv4(),
            entityId: fullEntityId,
            entityType: 'product',
            companyId: 'default',
            filename: file,
            originalName: file,
            mimeType: 'image/png',
            size: stats.size,
            position: positionNum,
            createdAt: stats.birthtime,
            path: filePath
        };

        console.log('Created metadata:', mediaFile);

        const metadataPath = `${filePath}.json`;
        await fs.promises.writeFile(
            metadataPath,
            JSON.stringify(mediaFile, null, 2)
        );

        console.log(`Created metadata file at: ${metadataPath}`);
    }
}

createMetadata().catch(error => {
    console.error('Error in createMetadata:', error);
    process.exit(1);
}); 