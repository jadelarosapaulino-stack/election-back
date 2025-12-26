"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.SeedModule = void 0;
var common_1 = require("@nestjs/common");
var seed_service_1 = require("./seed.service");
var seed_controller_1 = require("./seed.controller");
var products_module_1 = require("src/products/products.module");
var SeedModule = /** @class */ (function () {
    function SeedModule() {
    }
    SeedModule = __decorate([
        common_1.Module({
            controllers: [seed_controller_1.SeedController],
            providers: [seed_service_1.SeedService],
            imports: [
                products_module_1.ProductsModule
            ]
        })
    ], SeedModule);
    return SeedModule;
}());
exports.SeedModule = SeedModule;
