import NodeCache from 'node-cache';
import { MediaFile } from '../interfaces/MediaFile';

/**
 * Cache configuration for media files
 * - TTL: 2 hours (7200 seconds)
 * - Check period: 10 minutes (600 seconds)
 * - No cloning of stored objects
 */
export const mediaCache = new NodeCache({
    stdTTL: 7200, // 2 hours
    checkperiod: 600, // Check for expired entries every 10 minutes
    useClones: false
}); 