import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('should return status ok', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('ok');
    });

    it('should return a timestamp', () => {
      const result = appController.getHealth();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return version', () => {
      const result = appController.getHealth();
      expect(result.version).toBeDefined();
    });
  });
});
