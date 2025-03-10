import { Pool } from 'pg';
import { pool } from '../config/database';

interface MediaFile {
    id: string;
    entityId: string;
    entityType: string;
    companyId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    position: number;
    createdAt: Date;
    updatedAt: Date;
}

export class MediaRepository {
    private readonly db: Pool;

    constructor() {
        this.db = pool;
    }

    async create(data: Omit<MediaFile, 'id' | 'createdAt' | 'updatedAt'>): Promise<MediaFile> {
        const result = await this.db.query(
            `INSERT INTO media_files (
                entity_id, entity_type, company_id,
                filename, original_name, mime_type,
                size, position
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                data.entityId,
                data.entityType,
                data.companyId,
                data.filename,
                data.originalName,
                data.mimeType,
                data.size,
                data.position
            ]
        );
        return result.rows[0];
    }

    async findById(id: string): Promise<MediaFile | null> {
        const result = await this.db.query(
            'SELECT * FROM media_files WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    async findByEntityId(entityId: string, companyId: string): Promise<MediaFile[]> {
        const result = await this.db.query(
            'SELECT * FROM media_files WHERE entity_id = $1 AND company_id = $2 ORDER BY position',
            [entityId, companyId]
        );
        return result.rows;
    }

    async remove(id: string): Promise<void> {
        await this.db.query(
            'DELETE FROM media_files WHERE id = $1',
            [id]
        );
    }
} 