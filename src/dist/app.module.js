"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.AppModule = void 0;
var common_1 = require("@nestjs/common");
var config_1 = require("@nestjs/config");
var typeorm_1 = require("@nestjs/typeorm");
var products_module_1 = require("./products/products.module");
var common_module_1 = require("./common/common.module");
var seed_module_1 = require("./seed/seed.module");
var files_module_1 = require("./files/files.module");
var AppModule = /** @class */ (function () {
    function AppModule() {
    }
    AppModule = __decorate([
        common_1.Module({
            imports: [
                config_1.ConfigModule.forRoot(),
                typeorm_1.TypeOrmModule.forRoot({
                    type: 'postgres',
                    host: process.env.DB_HOST,
                    port: +process.env.DB_PORT,
                    database: process.env.DB_NAME,
                    username: process.env.DB_USERNAME,
                    password: process.env.DB_PASSWORD,
                    autoLoadEntities: true,
                    synchronize: true
                }),
                products_module_1.ProductsModule,
                common_module_1.CommonModule,
                seed_module_1.SeedModule,
                FilesNoSpecModule,
                files_module_1.FilesModule
            ]
        })
    ], AppModule);
    return AppModule;
}());
exports.AppModule = AppModule;
