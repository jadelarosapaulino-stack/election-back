<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# Teslo API

1. Clonar proyecto
2. ```` pnpm install ````
3. Clonar archivo ```` .env.template ```` y renombrarlo a ```` .env ````
4. Cambiar las variables de entorno
5. Levantar base de datos
````
docker-compose up
````

6. Ejecutar SEED
````
http://localhost:3000/api/seed
````

7. Levantar el proyecto ```` pnpm start:dev ````

## Endpoints

Prefijo global: `/api`

### Auth
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| POST | /api/auth/register | Crear usuario | Publica |
| POST | /api/auth/login | Iniciar sesion y generar tokens | Publica |
| POST | /api/auth/refresh | Renovar access token usando `refreshToken` | Publica |
| GET | /api/auth/check-status | Devuelve estado del token y usuario | JWT |
| GET | /api/auth/private | Ruta de prueba protegida | JWT |
| GET | /api/auth/private2 | Ruta de prueba con roles | JWT (admin, super-user) |
| GET | /api/auth/private3 | Ruta de prueba protegida | JWT |

**DTOs**  
- `CreateUserDto` (body registro): email, password (6-50 chars, al menos 1 mayus, 1 minus, 1 numero/simbolo), fullName.  
- `LoginUserDto` (body login): email, password con mismas reglas.  
- Respuestas: tokens JWT (access y refresh) mas usuario; `refresh` espera `{ refreshToken }`.

### Elections (admin)
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| POST | /api/elections | Crear eleccion | JWT (admin) |
| GET | /api/elections | Listar elecciones (paginacion) | JWT (admin) |
| GET | /api/elections/:term | Obtener eleccion por id/term | JWT (admin) |
| PATCH | /api/elections/:id | Actualizar eleccion | JWT (admin) |
| DELETE | /api/elections/:id | Eliminar eleccion | JWT (admin) |

**DTOs**  
- `CreateElectionDto` (body): title (>=3), description (>=10), startDate, endDate (ISO), status opcional (`StatusType`).  
- `UpdateElectionDto`: mismos campos, opcionales.  
- `PaginationDto` (query en GET): `limit`, `offset`, `ordertype`, `search`.

### Election Config
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| GET | /api/election-config/:electionId | Obtener configuracion de una eleccion | JWT |
| POST | /api/election-config | Crear configuracion inicial | JWT |
| PATCH | /api/election-config/:electionId | Actualizar configuracion (bloqueo por guard) | JWT |

**DTOs**  
- `CreateElectionConfigDto` / `UpdateElectionConfigDto` (body): electionId, startAt/endAt (ISO), timezone, votingMode, maxVotesPerVoter, allowMultipleSelections, requireAuthentication, anonymousVoting, logoUrl, resultVisibility, tieBreaker, extra (objeto libre).

### Questions & Timeline (admin)
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| POST | /api/questions | Crear pregunta | JWT (admin) |
| GET | /api/questions/:term | Listar preguntas de una eleccion (paginacion) | JWT (admin) |
| PATCH | /api/questions/update/:id | Actualizar pregunta | JWT (admin) |
| DELETE | /api/questions/:id | Eliminar pregunta | JWT (admin) |
| DELETE | /api/questions/:electionId/delete-all | Eliminar todas las preguntas de una eleccion | JWT (admin) |
| PATCH | /api/questions/reorder | Reordenar preguntas | JWT (admin) |
| PATCH | /api/questions/:questionId/options/reorder | Reordenar opciones de una pregunta | JWT (admin) |
| POST | /api/questions/timeline | Registrar accion en el timeline | Publica |

**DTOs**  
- `CreateQuestionDto` (body): title, description, election (id), type (`QuestionType`), order (numero), options opcionales.  
- `UpdateQuestionDto`: mismos campos, opcionales.  
- `OrderDto[]` (body en reorder*): lista de `{ id, order }` (enteros >=0).  
- Timeline POST espera un body libre con `voterId`, `electionId`, `action`, `metadata`.

### Options (admin)
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| POST | /api/options | Crear opcion | JWT (admin) |
| GET | /api/options | Listar opciones | JWT (admin) |
| GET | /api/options/:id | Obtener opcion | JWT (admin) |
| PATCH | /api/options/:id | Actualizar opcion | JWT (admin) |
| DELETE | /api/options/:id | Eliminar opcion | JWT (admin) |

**DTOs**  
- `CreateOptionDto` (body): title, description?, order?, question (id), images?, files?, type (`OptionType`).  
- `UpdateOptionDto`: mismos campos, opcionales.  
- `OrderDto[]` para reorder (ver seccion Questions).

### Voters
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| POST | /api/voter | Crear votante | Publica |
| GET | /api/voter/:electionId | Listar votantes por eleccion (paginacion) | Publica |
| GET | /api/voter/:electionId/all | Listar todos los votantes de una eleccion | Publica |
| GET | /api/voter/voter/:voterid | Obtener votante por id | Publica |
| PATCH | /api/voter/:id | Actualizar votante | Publica |
| DELETE | /api/voter/:id | Eliminar votante | Publica |
| DELETE | /api/voter/:electionId/remove-all | Eliminar votantes de una eleccion | Publica |
| POST | /api/voter/import | Importar votantes desde CSV (`file`) | Publica |
| GET | /api/voter/duplicates | Listar duplicados (por nombre + identificador) | Publica |
| DELETE | /api/voter/duplicates/:electionId | Eliminar duplicados de una eleccion | Publica |
| GET | /api/voter/duplicates/export?electionId= | Exportar duplicados a CSV | Publica |
| GET | /api/voter/duplicates/preview?electionId= | Previsualizar duplicados | Publica |

**DTOs**  
- `CreateVoterDto` (body): name, email?, election (id), identifier?, password?, metadata (objeto).  
- `UpdateVoterDto`: mismos campos, opcionales.  
- `PaginationDto` (query en GET lista): `limit`, `offset`, `ordertype`, `search`.  
- Import CSV: multipart con campo `file` + form-data `electionId` y `metadata`.

### Products
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| POST | /api/products | Crear producto | JWT |
| GET | /api/products | Listar productos (paginacion) | JWT |
| GET | /api/products/:term | Obtener producto por id/term | JWT |
| PATCH | /api/products/:id | Actualizar producto | JWT |
| DELETE | /api/products/:id | Eliminar producto | JWT |

**DTOs**  
- `CreateProductDto` (body): title, price?, description?, slug?, stock?, sizes[], gender (`men|women|kid|unisex`), tags?, images?.  
- `UpdateProductDto`: mismos campos, opcionales.  
- `PaginationDto` (query en GET).

### Vote
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| POST | /api/vote | Emitir un voto | Publica |

**DTOs**  
- `CastVoteDto` (body): `voterId`, `optionId`.

### Files
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| GET | /api/files/:fileName | Obtener archivo estatico | Publica |
| POST | /api/files | Subir archivo (`file`) | Publica |
| DELETE | /api/files/:fileName | Eliminar archivo | Publica |

**DTOs**  
- Upload: multipart con campo `file`.  
- Respuestas: upload devuelve metadata del archivo; GET/DELETE manejan archivos en `static/uploads`.

### Status (admin)
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| POST | /api/status | Crear estado | JWT (admin) |
| GET | /api/status | Listar estados | JWT (admin) |

**DTOs**  
- `CreateStatusDto` (body): title (>=3), color (>=5).  
- `UpdateStatusDto`: mismos campos opcionales.

### Seed (admin)
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| GET | /api/seed | Ejecutar seed de datos | JWT (admin) |

### Tenants
| Metodo | Ruta | Descripcion | Auth/Roles |
| --- | --- | --- | --- |
| POST | /api/tenants | Crear configuracion de usuario/tenant | Publica |
| GET | /api/tenants | Listar | Publica |
| GET | /api/tenants/:id | Obtener | Publica |
| PATCH | /api/tenants/:id | Actualizar | Publica |
| DELETE | /api/tenants/:id | Eliminar | Publica |

**DTOs**  
- `CreateTenantDto` / `UpdateTenantDto`: sin campos definidos (estructura libre segun entidad `UserSettings`).
