import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  isEmptyHtml,
  type CreateCompetitionContactInput,
  type CreateCompetitionLinkInput,
  type CreateGalleryImageInput,
  type UpdateCompetitionContactInput,
  type UpdateCompetitionInfoInput,
  type UpdateCompetitionLinkInput,
  type UpdateGalleryImageInput,
} from '@npha/shared';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { buildUploadUrl, toAbsoluteAssetUrl } from '../utils/assets.js';
import { sanitizeRichHtml } from '../utils/sanitize-html.js';
import { getCompetition } from './competition.service.js';

function mapGalleryImage(row: {
  id: string;
  competitionId: string;
  url: string;
  caption: string | null;
  displayOrder: number;
}) {
  return {
    id: row.id,
    competitionId: row.competitionId,
    url: toAbsoluteAssetUrl(row.url) ?? row.url,
    caption: row.caption,
    displayOrder: row.displayOrder,
  };
}

function mapLink(row: {
  id: string;
  competitionId: string;
  label: string;
  url: string;
  displayOrder: number;
}) {
  return {
    id: row.id,
    competitionId: row.competitionId,
    label: row.label,
    url: row.url,
    displayOrder: row.displayOrder,
  };
}

function mapContact(row: {
  id: string;
  competitionId: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  displayOrder: number;
  isPublic: boolean;
}) {
  return {
    id: row.id,
    competitionId: row.competitionId,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    displayOrder: row.displayOrder,
    isPublic: row.isPublic,
  };
}

function computeHasContent(input: {
  aboutHtml: string | null;
  dailyScheduleHtml: string | null;
  selectionRulesHtml: string | null;
  entryFeePaymentHtml: string | null;
  flyingSiteHtml: string | null;
  travelInfoHtml: string | null;
  latitude: number | null;
  longitude: number | null;
  galleryCount: number;
  linksCount: number;
  contactsCount: number;
}): boolean {
  return (
    !isEmptyHtml(input.aboutHtml) ||
    !isEmptyHtml(input.dailyScheduleHtml) ||
    !isEmptyHtml(input.selectionRulesHtml) ||
    !isEmptyHtml(input.entryFeePaymentHtml) ||
    !isEmptyHtml(input.flyingSiteHtml) ||
    !isEmptyHtml(input.travelInfoHtml) ||
    (input.latitude != null && input.longitude != null) ||
    input.galleryCount > 0 ||
    input.linksCount > 0 ||
    input.contactsCount > 0
  );
}

export async function getEventInfo(competitionId: string, opts?: { publicOnly?: boolean }) {
  const competition = await getCompetition(competitionId);
  const publicOnly = opts?.publicOnly ?? false;

  const [info, gallery, links, contacts] = await Promise.all([
    prisma.competitionInfo.findUnique({ where: { competitionId } }),
    prisma.competitionGalleryImage.findMany({
      where: { competitionId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.competitionLink.findMany({
      where: { competitionId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.competitionContact.findMany({
      where: {
        competitionId,
        ...(publicOnly ? { isPublic: true } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);

  const aboutHtml = info?.aboutHtml ?? null;
  const dailyScheduleHtml = info?.dailyScheduleHtml ?? null;
  const selectionRulesHtml = info?.selectionRulesHtml ?? null;
  const entryFeePaymentHtml = info?.entryFeePaymentHtml ?? null;
  const flyingSiteHtml = info?.flyingSiteHtml ?? null;
  const travelInfoHtml = info?.travelInfoHtml ?? null;

  const mappedGallery = gallery.map(mapGalleryImage);
  const mappedLinks = links.map(mapLink);
  const mappedContacts = contacts.map(mapContact);

  return {
    competitionId,
    aboutHtml,
    dailyScheduleHtml,
    selectionRulesHtml,
    entryFeePaymentHtml,
    flyingSiteHtml,
    travelInfoHtml,
    mapLabel: info?.mapLabel ?? null,
    mapZoom: info?.mapZoom ?? 13,
    latitude: competition.latitude,
    longitude: competition.longitude,
    venue: competition.venue,
    location: competition.location,
    gallery: mappedGallery,
    links: mappedLinks,
    contacts: mappedContacts,
    hasContent: computeHasContent({
      aboutHtml,
      dailyScheduleHtml,
      selectionRulesHtml,
      entryFeePaymentHtml,
      flyingSiteHtml,
      travelInfoHtml,
      latitude: competition.latitude,
      longitude: competition.longitude,
      galleryCount: mappedGallery.length,
      linksCount: mappedLinks.length,
      contactsCount: mappedContacts.length,
    }),
  };
}

export async function updateEventInfo(competitionId: string, input: UpdateCompetitionInfoInput) {
  await getCompetition(competitionId);

  const htmlFields = {
    ...(input.aboutHtml !== undefined
      ? { aboutHtml: sanitizeRichHtml(input.aboutHtml) }
      : {}),
    ...(input.dailyScheduleHtml !== undefined
      ? { dailyScheduleHtml: sanitizeRichHtml(input.dailyScheduleHtml) }
      : {}),
    ...(input.selectionRulesHtml !== undefined
      ? { selectionRulesHtml: sanitizeRichHtml(input.selectionRulesHtml) }
      : {}),
    ...(input.entryFeePaymentHtml !== undefined
      ? { entryFeePaymentHtml: sanitizeRichHtml(input.entryFeePaymentHtml) }
      : {}),
    ...(input.flyingSiteHtml !== undefined
      ? { flyingSiteHtml: sanitizeRichHtml(input.flyingSiteHtml) }
      : {}),
    ...(input.travelInfoHtml !== undefined
      ? { travelInfoHtml: sanitizeRichHtml(input.travelInfoHtml) }
      : {}),
    ...(input.mapLabel !== undefined ? { mapLabel: input.mapLabel ?? null } : {}),
    ...(input.mapZoom !== undefined ? { mapZoom: input.mapZoom } : {}),
  };

  const competitionUpdate: {
    latitude?: number | null;
    longitude?: number | null;
    location?: string | null;
  } = {};
  if (input.latitude !== undefined) competitionUpdate.latitude = input.latitude;
  if (input.longitude !== undefined) competitionUpdate.longitude = input.longitude;
  if (input.location !== undefined) competitionUpdate.location = input.location ?? null;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(htmlFields).length > 0) {
      await tx.competitionInfo.upsert({
        where: { competitionId },
        create: { competitionId, ...htmlFields },
        update: htmlFields,
      });
    }
    if (Object.keys(competitionUpdate).length > 0) {
      await tx.competition.update({
        where: { id: competitionId },
        data: competitionUpdate,
      });
    }
  });

  return getEventInfo(competitionId);
}

export async function createGalleryImage(
  competitionId: string,
  file: Express.Multer.File,
  input: CreateGalleryImageInput = {},
) {
  await getCompetition(competitionId);

  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    throw AppError.badRequest('Image must be PNG, JPEG, or WebP');
  }

  const ext =
    file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';

  const maxOrder = await prisma.competitionGalleryImage.aggregate({
    where: { competitionId },
    _max: { displayOrder: true },
  });

  const imageId = randomUUID().replace(/-/g, '').slice(0, 16);
  const dir = path.join(env.uploadDir, 'gallery', competitionId);
  await mkdir(dir, { recursive: true });
  const filename = `${imageId}${ext}`;
  await writeFile(path.join(dir, filename), file.buffer);

  const url = buildUploadUrl('gallery', competitionId, filename);
  const row = await prisma.competitionGalleryImage.create({
    data: {
      competitionId,
      url,
      caption: input.caption ?? null,
      displayOrder: input.displayOrder ?? (maxOrder._max.displayOrder ?? 0) + 1,
    },
  });
  return mapGalleryImage(row);
}

export async function updateGalleryImage(
  competitionId: string,
  imageId: string,
  input: UpdateGalleryImageInput,
) {
  const existing = await prisma.competitionGalleryImage.findFirst({
    where: { id: imageId, competitionId },
  });
  if (!existing) throw AppError.notFound('Gallery image not found');

  const row = await prisma.competitionGalleryImage.update({
    where: { id: imageId },
    data: {
      ...(input.caption !== undefined ? { caption: input.caption ?? null } : {}),
      ...(input.displayOrder != null ? { displayOrder: input.displayOrder } : {}),
    },
  });
  return mapGalleryImage(row);
}

export async function deleteGalleryImage(competitionId: string, imageId: string) {
  const existing = await prisma.competitionGalleryImage.findFirst({
    where: { id: imageId, competitionId },
  });
  if (!existing) throw AppError.notFound('Gallery image not found');
  await prisma.competitionGalleryImage.delete({ where: { id: imageId } });
  return { deleted: true };
}

export async function createLink(competitionId: string, input: CreateCompetitionLinkInput) {
  await getCompetition(competitionId);
  const maxOrder = await prisma.competitionLink.aggregate({
    where: { competitionId },
    _max: { displayOrder: true },
  });
  const row = await prisma.competitionLink.create({
    data: {
      competitionId,
      label: input.label,
      url: input.url,
      displayOrder: input.displayOrder ?? (maxOrder._max.displayOrder ?? 0) + 1,
    },
  });
  return mapLink(row);
}

export async function updateLink(
  competitionId: string,
  linkId: string,
  input: UpdateCompetitionLinkInput,
) {
  const existing = await prisma.competitionLink.findFirst({
    where: { id: linkId, competitionId },
  });
  if (!existing) throw AppError.notFound('Link not found');
  const row = await prisma.competitionLink.update({
    where: { id: linkId },
    data: {
      ...(input.label != null ? { label: input.label } : {}),
      ...(input.url != null ? { url: input.url } : {}),
      ...(input.displayOrder != null ? { displayOrder: input.displayOrder } : {}),
    },
  });
  return mapLink(row);
}

export async function deleteLink(competitionId: string, linkId: string) {
  const existing = await prisma.competitionLink.findFirst({
    where: { id: linkId, competitionId },
  });
  if (!existing) throw AppError.notFound('Link not found');
  await prisma.competitionLink.delete({ where: { id: linkId } });
  return { deleted: true };
}

export async function createContact(
  competitionId: string,
  input: CreateCompetitionContactInput,
) {
  await getCompetition(competitionId);
  const maxOrder = await prisma.competitionContact.aggregate({
    where: { competitionId },
    _max: { displayOrder: true },
  });
  const row = await prisma.competitionContact.create({
    data: {
      competitionId,
      name: input.name,
      role: input.role,
      phone: input.phone ?? null,
      email: input.email ?? null,
      displayOrder: input.displayOrder ?? (maxOrder._max.displayOrder ?? 0) + 1,
      isPublic: input.isPublic ?? true,
    },
  });
  return mapContact(row);
}

export async function updateContact(
  competitionId: string,
  contactId: string,
  input: UpdateCompetitionContactInput,
) {
  const existing = await prisma.competitionContact.findFirst({
    where: { id: contactId, competitionId },
  });
  if (!existing) throw AppError.notFound('Contact not found');
  const row = await prisma.competitionContact.update({
    where: { id: contactId },
    data: {
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.role != null ? { role: input.role } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
      ...(input.email !== undefined ? { email: input.email ?? null } : {}),
      ...(input.displayOrder != null ? { displayOrder: input.displayOrder } : {}),
      ...(input.isPublic != null ? { isPublic: input.isPublic } : {}),
    },
  });
  return mapContact(row);
}

export async function deleteContact(competitionId: string, contactId: string) {
  const existing = await prisma.competitionContact.findFirst({
    where: { id: contactId, competitionId },
  });
  if (!existing) throw AppError.notFound('Contact not found');
  await prisma.competitionContact.delete({ where: { id: contactId } });
  return { deleted: true };
}
