import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LandingContent } from './landing-content.entity';
import { CreateLandingContentDto } from './dto/create-landing-content.dto';
import { UpdateLandingContentDto } from './dto/update-landing-content.dto';
import { UpdateNavigationDto } from './dto/update-navigation.dto';
import { Election } from '../elections/entities/election.entity';
import { Voter } from '../voters/entities/voter.entity';
import { Vote } from '../vote/entities/vote.entity';
import { StatusType } from '../utils/status-type.enum';
import { randomUUID } from 'crypto';

const PROTECTED_SLUGS = [
  'sobre-nosotros',
  'blog',
  'carreras',
  'contacto',
  'privacidad',
  'terminos',
  'cookies',
  'gdpr',
] as const;

interface NavigationItemInput {
  id: string;
  sortOrder: number;
  parentId?: string;
  children?: NavigationItemInput[];
}

@Injectable()
export class LandingContentService {
  constructor(
    @InjectRepository(LandingContent)
    private readonly landingContentRepo: Repository<LandingContent>,
    @InjectRepository(Election)
    private readonly electionRepo: Repository<Election>,
    @InjectRepository(Voter)
    private readonly voterRepo: Repository<Voter>,
    @InjectRepository(Vote)
    private readonly voteRepo: Repository<Vote>,
  ) {}

  async getPublicStats() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const [electionsProcessed, activeElections, registeredVotesRaw, totalVoters, dailyRows] =
      await Promise.all([
        this.electionRepo.count(),
        this.electionRepo
          .createQueryBuilder('election')
          .where('election.status IN (:...statuses)', {
            statuses: [StatusType.ACTIVE, StatusType.RUNNING],
          })
          .getCount(),
        this.voterRepo
          .createQueryBuilder('voter')
          .leftJoin('voter.votes', 'realVote', 'realVote.isDemo = false')
          .select(
            'COUNT(DISTINCT CASE WHEN voter.vote = true OR realVote.id IS NOT NULL THEN voter.id END)',
            'count',
          )
          .getRawOne(),
        this.voterRepo.count(),
        this.voteRepo
          .createQueryBuilder('vote')
          .select("TO_CHAR(DATE_TRUNC('day', vote.votedAt), 'YYYY-MM-DD')", 'day')
          .addSelect('COUNT(DISTINCT vote.voterId)', 'count')
          .where('vote.isDemo = false')
          .andWhere('vote.votedAt >= :sevenDaysAgo', { sevenDaysAgo })
          .groupBy("DATE_TRUNC('day', vote.votedAt)")
          .orderBy("DATE_TRUNC('day', vote.votedAt)", 'ASC')
          .getRawMany(),
      ]);

    const votedVoters = Number(registeredVotesRaw?.count ?? 0);
    const participationPct = totalVoters
      ? Number(((votedVoters / totalVoters) * 100).toFixed(1))
      : 0;
    const countsByDay = new Map(
      dailyRows.map((row) => [String(row.day), Number(row.count ?? 0)]),
    );
    const dailyVotes = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(sevenDaysAgo);
      day.setUTCDate(day.getUTCDate() + index);
      const key = day.toISOString().slice(0, 10);
      return { day: key, count: countsByDay.get(key) ?? 0 };
    });

    return {
      electionsProcessed,
      activeElections,
      registeredVotes: votedVoters,
      totalVoters,
      votersWhoVoted: votedVoters,
      participationPct,
      dailyVotes,
    };
  }

  async getAllPages(): Promise<LandingContent[]> {
    return this.landingContentRepo.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createPage(dto: CreateLandingContentDto): Promise<LandingContent> {
    const existing = await this.landingContentRepo.findOne({
      where: { pageSlug: dto.pageSlug },
    });

    if (existing) {
      throw new BadRequestException(
        `A page with slug "${dto.pageSlug}" already exists`,
      );
    }

    const page = this.landingContentRepo.create({
      pageSlug: dto.pageSlug,
      pageTitle: dto.pageTitle,
      content: this.normalizePostDates(dto.content),
      metaTitle: dto.metaTitle ?? null,
      metaDescription: dto.metaDescription ?? null,
      parentId: dto.parentId ?? null,
      sortOrder: dto.sortOrder ?? 0,
      status: dto.status ?? 'published',
      template: dto.template ?? null,
      icon: dto.icon ?? null,
      isNavVisible: dto.isNavVisible ?? true,
    });

    return this.landingContentRepo.save(page);
  }

  async deletePage(id: string): Promise<void> {
    const page = await this.landingContentRepo.findOne({ where: { id } });

    if (!page) {
      throw new NotFoundException(`Landing page with id "${id}" not found`);
    }

    if (PROTECTED_SLUGS.includes(page.pageSlug as typeof PROTECTED_SLUGS[number])) {
      throw new BadRequestException(
        `Cannot delete protected page "${page.pageSlug}"`,
      );
    }

    await this.landingContentRepo.remove(page);
  }

  async getNavigation(): Promise<LandingContent[]> {
    return this.landingContentRepo.find({
      where: { status: 'published', isNavVisible: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async updateNavigation(dto: UpdateNavigationDto): Promise<void> {
    const flatItems = this.flattenNavigationItems(dto.navigation);

    await this.landingContentRepo.manager.transaction(async (manager) => {
      for (const item of flatItems) {
        await manager.update(
          LandingContent,
          { id: item.id },
          { sortOrder: item.sortOrder, parentId: item.parentId },
        );
      }
    });
  }

  private flattenNavigationItems(
    items: Array<{ id: string; sortOrder: number; parentId?: string; children?: NavigationItemInput[] }>,
    parentId: string | null = null,
  ): Array<{ id: string; sortOrder: number; parentId: string | null }> {
    const result: Array<{ id: string; sortOrder: number; parentId: string | null }> = [];

    for (const item of items) {
      result.push({ id: item.id, sortOrder: item.sortOrder, parentId });

      if (item.children && item.children.length > 0) {
        const childItems: NavigationItemInput[] = item.children.map((child) => ({
          id: child.id,
          sortOrder: child.sortOrder,
          parentId: item.id,
          children: child.children,
        }));
        result.push(...this.flattenNavigationItems(childItems, item.id));
      }
    }

    return result;
  }

  private getDefaultPage(slug: string): Partial<LandingContent> | null {
    const defaults: Record<string, Partial<LandingContent>> = {
      'sobre-nosotros': {
        pageTitle: 'Elecciones que inspiran confianza',
        metaTitle: 'Sobre nosotros | Voting Suite',
        metaDescription:
          'Conoce la historia, misión y valores de Voting Suite. Acompañamos a organizaciones e instituciones para que sus elecciones sean claras, participativas y confiables.',
        sortOrder: 0,
        status: 'published',
        isNavVisible: true,
        icon: 'info',
        template: 'about',
        content: {
          subtitle: 'Decisiones colectivas con claridad, confianza y cercanía.',

          about:
            'En Voting Suite creemos que cada decisión importante merece un proceso claro y accesible. Nacimos de la observación directa de organizaciones que enfrentaban dificultades para gestionar elecciones internas: padrones desactualizados, procesos opacos, resultados cuestionados y participantes que se sentían alejados del sistema. Vimos una oportunidad para cambiar eso con tecnología pensada para las personas. Hoy acompañamos a organizaciones, comunidades e instituciones en toda Latinoamérica para que puedan organizar sus elecciones con orden, brindar una experiencia simple a cada participante y comunicar resultados que generen confianza.',
            
            story:
              'La idea surgió en 2024, cuando un equipo de ingenieros, abogados electoralistas y diseñadores de experiencia de usuario se reunió para resolver un problema concreto: una cooperativa de 12.000 socios no podía realizar su asamblea anual porque el proceso de votación presencial era logísticamente inviable y las alternativas digitales existentes no cumplían con los estándares de transparencia que la organización necesitaba. En seis meses construimos la primera versión de Voting Suite. La cooperativa realizó su asamblea con participación récord y cero impugnaciones. Desde entonces, el producto ha crecido para atender desde asociaciones vecinales hasta instituciones públicas, siempre con el mismo principio: hacer que participar sea tan fácil como usar cualquier aplicación, y que organizar sea tan confiable como una auditoría.',
            
            mission:
              'Nuestra misión es facilitar procesos electorales transparentes y fáciles de gestionar, para que las personas puedan participar con seguridad y las organizaciones tomen decisiones con tranquilidad. Trabajamos para que la tecnología no sea una barrera, sino un puente que acerque a las personas con las decisiones que afectan su vida colectiva.',
            
            vision:
              'Aspiramos a que toda comunidad pueda decidir de forma informada, inclusiva y confiable, sin que la complejidad operativa sea una barrera para participar. Queremos ser la plataforma de referencia en elecciones digitales en Latinoamérica, reconocida no solo por su tecnología, sino por su compromiso con la democracia participativa y la accesibilidad universal.',
            
            values: [
              {
                title: 'Transparencia',
                description:
                  'Promovemos procesos claros con información comprensible en cada etapa. Desde la conformación del padrón hasta el escrutinio final, cada paso es auditable y verificable por los organizadores y los participantes.',
              },
              {
                title: 'Confianza',
                description:
                  'Cuidamos cada detalle para que organizadores y participantes decidan con tranquilidad. Implementamos cifrado de extremo a extremo, auditorías periódicas y políticas de privacidad que protegen la identidad de cada votante.',
              },
              {
                title: 'Inclusión',
                description:
                  'Diseñamos experiencias sencillas para que más personas puedan participar. Nuestra plataforma es accesible desde cualquier dispositivo, cumple con estándares WCAG 2.1 y está disponible en múltiples idiomas.',
              },
              {
                title: 'Acompañamiento',
                description:
                  'Estamos presentes antes, durante y después de cada proceso electoral. Ofrecemos soporte técnico en tiempo real, capacitación para organizadores y documentación completa para que cada elección sea un éxito.',
              },
              {
                title: 'Innovación responsable',
                description:
                  'Investigamos y aplicamos nuevas tecnologías con criterio ético. Cada funcionalidad que integramos pasa por una evaluación de impacto, seguridad y accesibilidad antes de llegar a nuestros usuarios.',
              },
              {
                title: 'Soberanía de datos',
                description:
                  'Los datos de cada organización son suyos. No los vendemos, no los compartimos y no los utilizamos con fines comerciales. Cada organización mantiene el control total sobre su información y la de sus participantes.',
              },
            ],

            whyUs: [
              {
                title: 'Diseño centrado en las personas',
                description:
                  'No construimos herramientas para técnicos. Diseñamos flujos que cualquier persona puede seguir sin capacitación previa, desde el organizador que configura la elección hasta el votante que emite su sufragio desde el celular.',
              },
              {
                title: 'Seguridad de nivel empresarial',
                description:
                  'Cifrado AES-256 en reposo, TLS 1.3 en tránsito, autenticación multifactor, aislamiento de datos por organización y auditorías de seguridad trimestrales. Cumplimos con GDPR y la Ley de Protección de Datos Personales de Argentina.',
              },
              {
                title: 'Escalabilidad comprobada',
                description:
                  'Nuestra infraestructura maneja desde elecciones de 50 participantes hasta procesos con más de 100.000 votantes simultáneos, con 99.9% de disponibilidad garantizada y tiempos de carga inferiores a 2 segundos.',
              },
              {
                title: 'Cumplimiento normativo',
                description:
                  'Cada proceso electoral que gestionamos está diseñado para cumplir con la normativa aplicable. Generamos reportes de auditoría, actas digitales y trazabilidad completa que satisfacen los requisitos legales de todo tipo de organización.',
              },
            ],

            stats: [
              { label: 'Elecciones organizadas', value: '340+' },
              { label: 'Votantes participaron', value: '280.000+' },
              { label: 'Organizaciones confían en nosotros', value: '85+' },
              { label: 'Disponibilidad de la plataforma', value: '99.9%' },
            ],
        },
      },

      blog: {
        pageTitle: 'Blog',
        metaTitle: 'Blog | Voting Suite',
        metaDescription:
          'Artículos, novedades y buenas prácticas sobre elecciones, democracia y tecnología.',
        sortOrder: 1,
        status: 'published',
        isNavVisible: true,
        icon: 'article',
        template: 'blog',
        content: {
          subtitle: 'Ideas, historias y novedades sobre elecciones y participación',
          description:
            'Exploramos tendencias, compartimos buenas prácticas y contamos historias de organizaciones que confían en Voting Suite para sus procesos electorales.',
          posts: [
            {
              title: 'Cómo preparar una elección interna sin estrés',
              excerpt:
                'Organizar una elección interna puede parecer abrumador, pero con una planificación clara y las herramientas adecuadas, el proceso se vuelve sencillo y confiable. Compartimos una guía paso a paso para que tu próxima elección sea un éxito.',
              date: '2026-07-10',
            },
            {
              title: 'Transparencia electoral: más que una palabra de moda',
              excerpt:
                'La transparencia no es solo mostrar resultados. Implica comunicar el proceso completo, desde la conformación del padrón hasta el escrutinio final. Analizamos qué significa realmente y cómo implementarla en tu organización.',
              date: '2026-06-22',
            },
            {
              title: 'Inclusión digital: claves para que todos puedan votar',
              excerpt:
                'Más de 400 millones de personas en América Latina viven con alguna forma de discapacidad. Diseñar procesos electorales accesibles no es solo un imperativo ético, sino una inversión en democracia real.',
              date: '2026-06-05',
            },
            {
              title: 'El futuro de la votación en línea: tendencias para 2026',
              excerpt:
                'Desde la verificación de identidad con biometría hasta el uso de tecnología blockchain para auditar resultados, exploramos las tendencias que están transformando cómo votamos en el mundo.',
              date: '2026-05-15',
            },
          ],
        },
      },

      carreras: {
        pageTitle: 'Trabaja con Nosotros',
        metaTitle: 'Carreras | Voting Suite',
        metaDescription:
          'Únete al equipo de Voting Suite y ayúdanos a construir elecciones más transparentes.',
        sortOrder: 2,
        status: 'published',
        isNavVisible: true,
        icon: 'work',
        template: 'careers',
        content: {
          subtitle: 'Construye el futuro de la participación democrática',
          description:
            'En Voting Suite buscamos personas apasionadas por la tecnología, la democracia y el impacto social. Si crees que las elecciones pueden ser más claras, accesibles y confiables, queremos conocerte.',
          positions: [
            {
              title: 'Full Stack Engineer',
              description:
                'Diseñá y construí funcionalidades completas de la plataforma, desde la interfaz de votación hasta los servicios de escrutinio. Trabajás con TypeScript, React, NestJS y PostgreSQL en un equipo que valora la calidad y la simplicidad.',
              location: 'Remoto / Buenos Aires, Argentina',
            },
            {
              title: 'Product Designer',
              description:
                'Creá experiencias de voto simples, accesibles y confiables para todo tipo de usuarios. Investigás, prototipás y validás soluciones que hacen que participar en una elección sea tan fácil como usar cualquier app.',
              location: 'Remoto / Buenos Aires, Argentina',
            },
            {
              title: 'DevOps Engineer',
              description:
                'Asegurá la disponibilidad y seguridad de la infraestructura que soporta procesos electorales críticos. Gestionás pipelines CI/CD, monitoreo, escalabilidad y respuesta a incidentes en un entorno donde cada minuto de downtime cuenta.',
              location: 'Remoto / Buenos Aires, Argentina',
            },
            {
              title: 'Data Analyst',
              description:
                'Analizás datos de participación, rendimiento de la plataforma y métricas de elecciones para generar insights accionables. Colaborás con producto e ingeniería para mejorar la experiencia y documentar el impacto de cada proceso electoral.',
              location: 'Remoto / Buenos Aires, Argentina',
            },
          ],
        },
      },

      contacto: {
        pageTitle: 'Contacto',
        metaTitle: 'Contacto | Voting Suite',
        metaDescription: '¿Tenés preguntas? Contactanos y te ayudamos.',
        sortOrder: 3,
        status: 'published',
        isNavVisible: true,
        icon: 'mail',
        template: 'contact',
        content: {
          subtitle: 'Estamos para ayudarte',
          description:
            'Ya sea que tengas una pregunta sobre la plataforma, necesites asistencia técnica o quieras conocernos mejor, no dudes en escribirnos.',
          email: 'hola@votingsuite.com',
          phone: '+54 11 5555-0100',
          address: 'Av. Corrientes 1234, Piso 8, Buenos Aires, C1043AAZ, Argentina',
        },
      },

      privacidad: {
        pageTitle: 'Política de Privacidad',
        metaTitle: 'Política de Privacidad | Voting Suite',
        metaDescription:
          'Conocé cómo Voting Suite protege y maneja tu información personal.',
        sortOrder: 4,
        status: 'published',
        isNavVisible: false,
        icon: 'lock',
        template: 'legal',
        content: {
          subtitle: 'Tu información está protegida',
          body: 'En Voting Suite tomamos la privacidad de nuestros usuarios con la máxima seriedad. Esta política describe qué datos recopilamos, cómo los utilizamos y qué medidas tomamos para resguardarlos.',
          sections: [
            {
              title: 'Datos que recopilamos',
              content:
                'Recopilamos únicamente la información estrictamente necesaria para prestar el servicio electoral. Esto incluye: datos de identificación del organizador (nombre, email, organización), datos de participantes cargados por el organizador para conformar el padrón electoral, y datos de uso de la plataforma (dirección IP, navegador, timestamps de acción). No recopilamos datos financieros, biométricos ni de salud de los participantes. Los datos de voto se almacenan de forma anónima e irrevocablemente desvinculados de la identidad del votante.',
            },
            {
              title: 'Cómo usamos tu información',
              content:
                'Utilizamos los datos recopilados para: (a) prestar y mantener el servicio electoral, incluyendo la gestión de padrones, votaciones y escrutinios; (b) comunicarnos con el organizador sobre el estado de sus procesos electorales; (c) mejorar la plataforma a partir de métricas de uso agregadas y anónimas; (d) cumplir con obligaciones legales cuando aplique. Nunca vendemos, compartimos ni cedemos datos personales a terceros para fines comerciales.',
            },
            {
              title: 'Seguridad de los datos',
              content:
                'Implementamos medidas técnicas y organizativas robustas: cifrado en tránsito (TLS 1.2+) y en reposo (AES-256), autenticación multifactor para accesos administrativos, auditorías de seguridad periódicas, backups cifrados con retención controlada, y segmentación de red. Los procesos electorales se ejecutan en entornos aislados para evitar interferencias entre organizaciones. Cumplimos con SOC 2 Type II y realizamos pruebas de penetración trimestrales.',
            },
            {
              title: 'Tus derechos',
              content:
                'Conforme a la Ley de Protección de Datos Personales (Ley 25.326) y el GDPR, tenés derecho a: acceder a tus datos personales, solicitar su rectificación o eliminación, oponerte a su tratamiento, solicitar la portabilidad de tus datos, y revocar el consentimiento otorgado. Para ejercer estos derechos, escribí a privacidad@votingsuite.com. Respondemos todas las solicitudes en un plazo máximo de 30 días.',
            },
            {
              title: 'Contacto',
              content:
                'Si tenés consultas sobre esta política de privacidad o sobre el tratamiento de tus datos personales, podés comunicarte con nuestro equipo de privacidad a través de privacidad@votingsuite.com o escribiéndonos a Av. Corrientes 1234, Piso 8, Buenos Aires, C1043AAZ, Argentina.',
            },
          ],
        },
      },

      terminos: {
        pageTitle: 'Términos y Condiciones',
        metaTitle: 'Términos y Condiciones | Voting Suite',
        metaDescription:
          'Conocé los términos de uso de la plataforma Voting Suite.',
        sortOrder: 5,
        status: 'published',
        isNavVisible: false,
        icon: 'description',
        template: 'legal',
        content: {
          subtitle: 'Términos de uso de la plataforma',
          body: 'Al utilizar Voting Suite, aceptás los siguientes términos y condiciones. Te recomendamos leerlos cuidadosamente.',
          sections: [
            {
              title: 'Aceptación de los términos',
              content:
                'Al acceder o utilizar la plataforma Voting Suite, declarás que tenés capacidad legal para aceptar estos términos en nombre de la organización que representás. Si no estás de acuerdo con alguna parte de estos términos, no debés utilizar la plataforma. Nos reservamos el derecho de modificar estos términos en cualquier momento, notificándote con al menos 15 días de anticipación por email cuando los cambios sean sustanciales.',
            },
            {
              title: 'Uso de la plataforma',
              content:
                'Voting Suite es una herramienta para la gestión de procesos electorales internos. Te comprometés a utilizar la plataforma de conformidad con la ley aplicable y estos términos. Está prohibido: usar la plataforma para elecciones públicas sin autorización legal, intentar acceder no autorizado a sistemas o datos de otros usuarios, interferir con el funcionamiento de la plataforma, o utilizar la plataforma para transmitir contenido malicioso. El organizador es responsable del contenido cargado, incluyendo la veracidad del padrón electoral y el cumplimiento de las normas internas de su organización.',
            },
            {
              title: 'Cuentas y responsabilidades',
              content:
                'Para utilizar la plataforma necesitás una cuenta de organizador. Sos responsable de mantener la confidencialidad de tus credenciales y de todas las actividades realizadas desde tu cuenta. Debes notificarnos inmediatamente ante cualquier uso no autorizado. Voting Suite no se hace responsable por daños derivados del uso indebido de tu cuenta. Cada organización es responsable de designar administradores y definir los permisos de acceso dentro de su organización.',
            },
            {
              title: 'Propiedad intelectual',
              content:
                'Todo el software, diseño, marca, logotipo y contenidos de la plataforma son propiedad de Voting Suite o de sus licenciantes, protegidos por las leyes de propiedad intelectual aplicables. Estás autorizado a utilizar la plataforma según el plan contratado, pero no podés copiar, modificar, distribuir o crear obras derivadas del software. El contenido cargado por el organizador (textos, imágenes, documentos del proceso electoral) sigue siendo de su exclusiva propiedad.',
            },
            {
              title: 'Limitación de responsabilidad',
              content:
                'Voting Suite proporciona la plataforma "tal cual" y se esfuerza por garantizar su disponibilidad y correcto funcionamiento. Sin embargo, no podemos garantizar interrupciones cero. En ningún caso seremos responsables por daños indirectos, pérdida de datos, o consecuencias del uso de la plataforma. Nuestra responsabilidad total no excederá el monto pagado por el organizador en los 12 meses anteriores al evento que dio lugar al reclamo. El organizador es responsable de realizar backups de su información crítica.',
            },
            {
              title: 'Modificaciones',
              content:
                'Nos reservamos el derecho de actualizar estos términos para reflejar cambios en la plataforma, la ley o nuestras prácticas. Las modificaciones menores se publicarán en esta página sin notificación adicional. Para cambios sustanciales, te notificaremos por email con al menos 15 días de anticipación. El uso continuado de la plataforma después de la vigencia de los cambios constituye aceptación de los mismos.',
            },
          ],
        },
      },

      cookies: {
        pageTitle: 'Política de Cookies',
        metaTitle: 'Política de Cookies | Voting Suite',
        metaDescription:
          'Información sobre el uso de cookies en Voting Suite.',
        sortOrder: 6,
        status: 'published',
        isNavVisible: false,
        icon: 'cookie',
        template: 'legal',
        content: {
          subtitle: 'Cómo utilizamos las cookies',
          body: 'Utilizamos cookies y tecnologías similares para mejorar tu experiencia, analizar el uso de la plataforma y personalizar el contenido.',
          sections: [
            {
              title: '¿Qué son las cookies?',
              content:
                'Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitás un sitio web. Permiten que el sitio recuerde tus acciones y preferencias a lo largo del tiempo, para que no tengas que configurarlas cada vez que visitás la plataforma. Además de cookies, utilizamos tecnologías similares como web beacons y almacenamiento local del navegador.',
            },
            {
              title: 'Cookies que utilizamos',
              content:
                'Voting Suite utiliza las siguientes categorías de cookies: (a) Cookies estrictamente necesarias: son esenciales para el funcionamiento de la plataforma, como las de sesión de autenticación y seguridad (CSRF token). No pueden desactivarse. (b) Cookies de rendimiento: nos ayudan a entender cómo se utiliza la plataforma (páginas visitadas, tiempo de permanencia) de forma agregada y anónima, para mejorar el servicio. (c) Cookies de funcionalidad: permiten recordar preferencias como idioma o configuración de visualización. No utilizamos cookies de publicidad o rastreo de terceros.',
            },
            {
              title: 'Gestión de cookies',
              content:
                'Podés gestionar las cookies desde la configuración de tu navegador. La mayoría de los navegadores permiten bloquear o eliminar cookies, o recibir una notificación antes de que se almacenen. Tenés en cuenta que desactivar las cookies estrictamente necesarias puede afectar el funcionamiento de la plataforma. Para más información sobre cómo configurar las cookies en tu navegador, consultá la sección de ayuda del mismo.',
            },
            {
              title: 'Actualizaciones de esta política',
              content:
                'Podemos actualizar esta política de cookies para reflejar cambios en las tecnologías que utilizamos o por razones legales. Las actualizaciones se publicarán en esta página con la fecha de última revisión. Te recomendamos revisar esta política periódicamente. El uso continuado de la plataforma después de cualquier cambio constituye tu aceptación.',
            },
          ],
        },
      },

      gdpr: {
        pageTitle: 'Protección de Datos (GDPR)',
        metaTitle: 'Protección de Datos (GDPR) | Voting Suite',
        metaDescription:
          'Cómo Voting Suite cumple con el Reglamento General de Protección de Datos.',
        sortOrder: 7,
        status: 'published',
        isNavVisible: false,
        icon: 'shield',
        template: 'legal',
        content: {
          subtitle: 'Nuestro compromiso con la protección de datos',
          body: 'Voting Suite cumple con el Reglamento General de Protección de Datos (GDPR) de la Unión Europea y adopta las mejores prácticas internacionales de protección de información.',
          sections: [
            {
              title: 'Base legal del tratamiento',
              content:
                'Tratamos datos personales bajo las siguientes bases legales del GDPR: (a) Ejecución de un contrato: cuando el tratamiento es necesario para prestar el servicio electoral contratado; (b) Interés legítimo: para mejorar la plataforma, prevenir fraudes y garantizar la seguridad del servicio; (c) Consentimiento: cuando es necesario para comunicaciones de marketing o cookies no esenciales; (d) Obligación legal: cuando debemos conservar datos para cumplir con normativas electorales o fiscales aplicables.',
            },
            {
              title: 'Derechos del titular',
              content:
                'Si residís en el Espacio Económico Europeo, tenés los siguientes derechos bajo el GDPR: derecho de acceso (obtener confirmación y copia de tus datos), derecho de rectificación (corregir datos inexactos), derecho de supresión ("derecho al olvido"), derecho a la restricción del tratamiento, derecho a la portabilidad de datos, derecho de oposición al tratamiento, y derecho a no ser objeto de decisiones automatizadas con efectos legales. Para ejercer estos derechos, contactá a nuestro Delegado de Protección de Datos en dpo@votingsuite.com.',
            },
            {
              title: 'Transferencias internacionales',
              content:
                'Voting Suite opera con servidores ubicados en la Unión Europea y en la región de LATAM. Cuando transferimos datos fuera del EEE, nos aseguramos de que existan garantías adecuadas, como Cláusulas Contractuales Estándar (SCC) aprobadas por la Comisión Europea, o que el país de destino cuente con una decisión de adecuación. No transferimos datos a jurisdicciones que no ofrezcan un nivel de protección equivalente sin tu consentimiento explícito.',
            },
            {
              title: 'Seguridad y cifrado',
              content:
                'Aplicamos medidas técnicas y organizativas proporcionales al riesgo: cifrado AES-256 en reposo y TLS 1.3 en tránsito, segregación de datos por organización, control de acceso basado en roles (RBAC), registro de auditoría de accesos, pruebas de penetración periódicas, y un plan de respuesta a incidentes documentado. Realizamos evaluaciones de impacto a la protección de datos (DPIA) para procesos que involucren alto riesgo para los derechos y libertades de los titulares.',
            },
            {
              title: 'Contacto del Delegado de Protección de Datos',
              content:
                'Nuestro Delegado de Protección de Datos (DPO) está disponible para resolver cualquier consulta relacionada con el tratamiento de datos personales bajo el GDPR. Podés contactarlo a través de dpo@votingsuite.com o por correo postal a Av. Corrientes 1234, Piso 8, Buenos Aires, C1043AAZ, Argentina. Si no estás satisfecho con nuestra respuesta, tenés derecho a presentar una reclamación ante la autoridad de control de protección de datos de tu jurisdicción.',
            },
          ],
        },
      },
    };

    return defaults[slug] ?? null;
  }

  async getPageBySlug(slug: string): Promise<LandingContent> {
    const page = await this.landingContentRepo.findOne({ where: { pageSlug: slug } });
    const defaults = this.getDefaultPage(slug);

    if (!page) {
      const defaultPage = this.landingContentRepo.create({
        pageSlug: slug,
        pageTitle: defaults?.pageTitle || slug,
        content: defaults?.content || {},
        metaTitle: defaults?.metaTitle,
        metaDescription: defaults?.metaDescription,
        parentId: defaults?.parentId ?? null,
        sortOrder: defaults?.sortOrder ?? 0,
        status: defaults?.status ?? 'published',
        template: defaults?.template ?? null,
        icon: defaults?.icon ?? null,
        isNavVisible: defaults?.isNavVisible ?? true,
      });
      return this.attachPublicStats(await this.landingContentRepo.save(defaultPage));
    }

    if (defaults && Object.keys(page.content || {}).length === 0) {
      Object.assign(page, defaults);
      return this.attachPublicStats(await this.landingContentRepo.save(page));
    }

    return this.attachPublicStats(page);
  }

  private async attachPublicStats(page: LandingContent): Promise<LandingContent> {
    if (page.pageSlug !== 'sobre-nosotros') return page;
    const stats = await this.getPublicStats();
    page.content = {
      ...(page.content || {}),
      stats: [
        { label: 'Elecciones procesadas', value: String(stats.electionsProcessed) },
        { label: 'Votos registrados', value: String(stats.registeredVotes) },
        { label: 'Votantes registrados', value: String(stats.totalVoters) },
        { label: 'Participación global', value: `${stats.participationPct.toFixed(1)}%` },
      ],
    };
    return page;
  }

  async updatePage(slug: string, dto: UpdateLandingContentDto): Promise<LandingContent> {
    const page = await this.landingContentRepo.findOne({ where: { pageSlug: slug } });
    if (!page) {
      throw new NotFoundException(`Landing page with slug "${slug}" not found`);
    }
    Object.assign(page, {
      ...dto,
      content: this.normalizePostDates(dto.content, page.content),
    });
    page.updatedAt = new Date();
    return this.landingContentRepo.save(page);
  }

  private normalizePostDates(
    content: Record<string, unknown>,
    previousContent: Record<string, unknown> = {},
  ): Record<string, unknown> {
    if (!Array.isArray(content?.['posts'])) return content;

    const previousPosts = Array.isArray(previousContent?.['posts'])
      ? previousContent['posts'] as Array<Record<string, unknown>>
      : [];
    const previousById = new Map(
      previousPosts
        .filter((post) => typeof post?.['id'] === 'string')
        .map((post) => [String(post['id']), post]),
    );
    const today = this.localIsoDate(new Date());
    const posts = (content['posts'] as Array<Record<string, unknown>>).map((post, index) => {
      const requestedId = typeof post?.['id'] === 'string' ? String(post['id']) : '';
      const previous = previousById.get(requestedId) || previousPosts[index];
      const previousDate = typeof previous?.['date'] === 'string' ? String(previous['date']) : '';
      return {
        ...post,
        id: requestedId || (typeof previous?.['id'] === 'string' ? previous['id'] : randomUUID()),
        date: previousDate || today,
      };
    });

    return { ...content, posts };
  }

  private localIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
