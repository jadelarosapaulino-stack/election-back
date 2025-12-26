"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.ProductImage = void 0;
var typeorm_1 = require("typeorm");
var _1 = require(".");
var ProductImage = /** @class */ (function () {
    function ProductImage() {
    }
    __decorate([
        typeorm_1.PrimaryGeneratedColumn()
    ], ProductImage.prototype, "id");
    __decorate([
        typeorm_1.Column('text')
    ], ProductImage.prototype, "url");
    __decorate([
        typeorm_1.ManyToOne(function () { return _1.Product; }, function (product) { return product.images; }, {
            onDelete: 'CASCADE'
        })
    ], ProductImage.prototype, "product");
    ProductImage = __decorate([
        typeorm_1.Entity({ name: 'product_images' })
    ], ProductImage);
    return ProductImage;
}());
exports.ProductImage = ProductImage;
