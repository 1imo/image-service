import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3003';

/**
 * Extended Request interface that includes authenticated service information
 */
export interface AuthenticatedRequest extends Request {
    service?: {
        /** Unique identifier of the authenticated service */
        id: string;
        /** Name of the authenticated service */
        name: string;
        /** List of services this service is allowed to access */
        allowedServices: string[];
    };
}

/**
 * Middleware to authenticate service-to-service communication
 * Verifies service credentials with the auth service
 * 
 * @returns Express middleware function
 */
export const serviceAuth = () => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/verify`, {}, {
            headers: {
                'X-API-Key': req.header('X-API-Key'),
                'X-Service-Name': req.header('X-Service-Name'),
                'X-Target-Service': 'image-service',
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            (req as AuthenticatedRequest).service = response.data;
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Service authentication error:', error);
        res.status(401).json({ error: 'Unauthorized' });
    }
}; 