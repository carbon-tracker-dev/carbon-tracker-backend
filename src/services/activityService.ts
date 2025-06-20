import { prisma } from '../db/prismaClient';
import { Prisma } from '@prisma/client';
import { ActivityInput, EditActivityInput, GetActivitiesInput } from '../types';
import {
    deleteActivityByIdAndUserId,
    fetchActivityById,
    getSummaryByUserId,
    updateActivityByIdAndUserId,
} from '../db/activity';
import { SortBy, SortOrder } from '../enums';
import redisClient from '../config/redis';

export const addActivityService = async ({
    category,
    description,
    emission,
    activityDate,
    userId,
}: ActivityInput) => {
    try {
        const activity = await prisma.activity.create({
            data: {
                category,
                description,
                emission,
                date: activityDate,
                user: { connect: { id: userId } },
            },
        });
        await redisClient.del(`summary:${userId}`);
        return activity;
    } catch (error: any) {
        throw new Error(`${error.message}`);
    }
};

export const deleteActivityService = async (id: number, userId: number) => {
    try {
        const deletedActivity = await deleteActivityByIdAndUserId(id, userId);
        await redisClient.del(`summary:${userId}`);
        return deletedActivity;
    } catch (error: any) {
        throw new Error(`${error.message}`);
    }
};

export const getActivitiesByUserIdService = async ({
    userId,
    search = '',
    page = 1,
    limit = 10,
    sortBy = SortBy.DATE,
    sortOrder = SortOrder.DESC,
}: GetActivitiesInput) => {
    try {
        const activities = await prisma.activity.findMany({
            where: {
                userId,
                OR: [
                    { category: { contains: search, mode: Prisma.QueryMode.insensitive } },
                    { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
                ],
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
        });

        // Only call count if findMany succeeds
        const total = await prisma.activity.count({
            where: {
                userId,
                OR: [
                    { category: { contains: search, mode: Prisma.QueryMode.insensitive } },
                    { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
                ],
            },
        });

        const pages = Math.ceil(total / limit);

        return {
            data: activities,
            pagination: {
                total,
                page,
                limit,
                pages,
            },
        };
    } catch (err) {
        throw new Error('Database query failed');
    }
};

export const getActivityByIdAndUserIdService = async (id: number, userId: number) => {
    try {
        return await fetchActivityById(id, userId);
    } catch (error: any) {
        throw new Error(`${error.message}`);
    }
};

export const updateActivityService = async ({
    id,
    userId,
    category,
    emission,
    description,
    activityDate,
}: EditActivityInput) => {
    try {
        const updatedActivity = await updateActivityByIdAndUserId({
            id,
            userId,
            category,
            emission,
            description,
            activityDate,
        });
        await redisClient.del(`summary:${userId}`);
        return updatedActivity;
    } catch (error: any) {
        throw new Error(`${error.message}`);
    }
};

export const getSummaryService = async (userId: number) => {
    try {
        const cacheKey = `summary:${userId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached); // return cached version
        }

        const summary = await getSummaryByUserId(userId);

        await redisClient.setEx(cacheKey, 3600, JSON.stringify(summary));

        return summary;
    } catch (error: any) {
        throw new Error(`${error.message}`);
    }
};
