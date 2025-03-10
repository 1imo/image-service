/**
 * Represents a media file in the system
 */
export interface MediaFile {
    /** Unique identifier for the media file */
    id: string;
    /** ID of the entity this media belongs to (e.g., product ID) */
    entityId: string;
    /** Type of entity this media belongs to (e.g., 'product', 'user') */
    entityType: string;
    /** ID of the company that owns this media */
    companyId: string;
    /** System filename of the media file */
    filename: string;
    /** Original filename provided by the user */
    originalName: string;
    /** MIME type of the file */
    mimeType: string;
    /** Size of the file in bytes */
    size: number;
    /** Position/order of this file in its entity's media collection */
    position: number;
    /** Timestamp when the file was created */
    createdAt: Date;
    /** Full path to the file on disk */
    path: string;
} 