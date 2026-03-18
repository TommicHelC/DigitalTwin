import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import * as path from 'path';
import * as fs from 'fs';

const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/vnd.dwg',
  'application/acad',
  'application/x-acad',
  'application/autocad_dwg',
  'image/x-dwg',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.dwg'];

export interface UploadDocumentParams {
  siteId: string;
  deviceId?: string;
  type: string;
  name: string;
  clientId: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}

  async findByDevice(deviceId: string, clientId: string): Promise<Document[]> {
    return this.documentRepo
      .createQueryBuilder('doc')
      .innerJoin('doc.site', 's')
      .where('doc.device_id = :deviceId', { deviceId })
      .andWhere('s.client_id = :clientId', { clientId })
      .orderBy('doc.uploaded_at', 'DESC')
      .getMany();
  }

  async findBySite(siteId: string, clientId: string): Promise<Document[]> {
    return this.documentRepo
      .createQueryBuilder('doc')
      .innerJoin('doc.site', 's')
      .where('doc.site_id = :siteId', { siteId })
      .andWhere('s.client_id = :clientId', { clientId })
      .orderBy('doc.uploaded_at', 'DESC')
      .getMany();
  }

  async uploadDocument(
    file: Express.Multer.File,
    params: UploadDocumentParams,
  ): Promise<Document> {
    // Walidacja rozszerzenia
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    // Walidacja MIME
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid MIME type: ${file.mimetype}`,
      );
    }

    // Ścieżka zapisu
    const targetDir = path.join(
      '/app/documents',
      params.clientId,
      params.siteId,
    );
    fs.mkdirSync(targetDir, { recursive: true });

    const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const document = this.documentRepo.create({
      siteId: params.siteId,
      deviceId: params.deviceId ?? null,
      type: params.type,
      name: params.name,
      filePath,
    });

    return this.documentRepo.save(document);
  }

  async getFilePath(id: string, clientId: string): Promise<string> {
    const doc = await this.documentRepo
      .createQueryBuilder('doc')
      .innerJoin('doc.site', 's')
      .where('doc.id = :id', { id })
      .andWhere('s.client_id = :clientId', { clientId })
      .getOne();

    if (!doc) throw new NotFoundException(`Document ${id} not found`);

    if (!fs.existsSync(doc.filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    return doc.filePath;
  }
}
