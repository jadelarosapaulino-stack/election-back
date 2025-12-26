export class ResultDto<T> {
  success: boolean = false;
  message: string = '';
  data: T[] = [];
  totalPosts: number = 0;
  totalPages: number = 0;
  currentPage: number = 1;
  limit: number = 10;

  constructor(init?: Partial<ResultDto<T>>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}


// import { Repository, SelectQueryBuilder, EntityTarget, EntityManager } from 'typeorm';
// import { FindManyOptions } from 'typeorm';

// export interface PaginationResult<T> {
//   data: T[];
//   totalItems: number;
//   totalPages: number;
//   currentPage: number;
//   limit: number;
// }

// export class PaginationService {

//   static async paginate<T>(
//     repository: Repository<T>,
//     page: number = 1,
//     limit: number = 10,
//     filters: Record<string, any> = {},
//   ): Promise<PaginationResult<T>> {
//     // Calcular el "skip" para la paginación
//     const skip = (page - 1) * limit;

//     // Crear las condiciones de búsqueda dinámicas
//     const whereConditions: FindManyOptions<T>['where'] = {};

//     Object.keys(filters).forEach((key) => {
//       if (filters[key]) {
//         whereConditions[key] = filters[key];
//       }
//     });

//     // Hacer la consulta con filtros, paginación y orden
//     const [data, totalItems] = await repository.findAndCount({
//       where: whereConditions, // Aplicar filtros
//       skip, // Paginar
//       take: limit, // Resultados por página
//     //   order: {
//     //     createdAt: 'DESC', // O cualquier campo por el que quieras ordenar
//     //   },
//     });

//     // Calcular el número de páginas
//     const totalPages = Math.ceil(totalItems / limit);

//     return {
//       data,
//       totalItems,
//       totalPages,
//       currentPage: page,
//       limit,
//     };
//   }
// }

