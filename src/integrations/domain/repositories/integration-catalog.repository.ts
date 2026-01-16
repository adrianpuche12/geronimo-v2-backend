import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { IntegrationCatalog } from '../entities/integration-catalog.entity';

@Injectable()
export class IntegrationCatalogRepository extends Repository<IntegrationCatalog> {
  constructor(private dataSource: DataSource) {
    super(IntegrationCatalog, dataSource.createEntityManager());
  }

  /**
   * Find all active integrations in the catalog
   */
  async findAllActive(): Promise<IntegrationCatalog[]> {
    return this.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find integrations by category
   * @param category - Category (e.g., 'development', 'email', 'storage')
   */
  async findByCategory(category: string): Promise<IntegrationCatalog[]> {
    return this.find({
      where: { category, isActive: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find integrations by industry
   * @param industry - Industry (e.g., 'tech', 'automotive', 'sales', 'all')
   */
  async findByIndustry(industry: string): Promise<IntegrationCatalog[]> {
    return this.find({
      where: [
        { forIndustry: industry, isActive: true },
        { forIndustry: 'all', isActive: true },
      ],
      order: { name: 'ASC' },
    });
  }

  /**
   * Find integration by ID
   * @param id - Integration ID (e.g., 'int-001')
   */
  async findById(id: string): Promise<IntegrationCatalog | null> {
    return this.findOne({
      where: { id, isActive: true },
    });
  }
}
