import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  const prismaMock = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports liveness without touching the database', () => {
    const result = controller.live();
    expect(result.status).toBe('ok');
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('reports db health by round-tripping a query', async () => {
    const result = await controller.db();
    expect(result).toEqual({ status: 'ok', database: 'connected' });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
