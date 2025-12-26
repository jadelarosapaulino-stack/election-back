"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.Product = void 0;
var typeorm_1 = require("typeorm");
var _1 = require("./");
var Product = /** @class */ (function () {
    function Product() {
    }
    // @BeforeUpdate()
    Product.prototype.checkSlugToInsert = function () {
        if (!this.slug) {
            this.slug = this.title;
        }
        this.slug = this.slug
            .toLowerCase()
            .replaceAll(' ', '_')
            .replaceAll("'", '');
    };
    Product.prototype.checkSlugToUpdateInsert = function () {
        this.slug = this.slug
            .toLowerCase()
            .replaceAll(' ', '_')
            .replaceAll("'", '');
    };
    __decorate([
        typeorm_1.PrimaryGeneratedColumn('uuid')
    ], Product.prototype, "id");
    __decorate([
        typeorm_1.Column('text', { unique: true })
    ], Product.prototype, "title");
    __decorate([
        typeorm_1.Column('float', { "default": 0 })
    ], Product.prototype, "price");
    __decorate([
        typeorm_1.Column({
            type: 'text',
            nullable: true
        })
    ], Product.prototype, "description");
    __decorate([
        typeorm_1.Column('text', {
            unique: true
        })
    ], Product.prototype, "slug");
    __decorate([
        typeorm_1.Column('int', {
            "default": 0
        })
    ], Product.prototype, "stock");
    __decorate([
        typeorm_1.Column('text', {
            array: true
        })
    ], Product.prototype, "sizes");
    __decorate([
        typeorm_1.Column('text')
    ], Product.prototype, "gender");
    __decorate([
        typeorm_1.Column('text', {
            array: true,
            "default": []
        })
    ], Product.prototype, "tags");
    __decorate([
        typeorm_1.OneToMany(function () { return _1.ProductImage; }, function (productImage) { return productImage.product; }, { cascade: true, eager: true })
    ], Product.prototype, "images");
    __decorate([
        typeorm_1.BeforeInsert()
    ], Product.prototype, "checkSlugToInsert");
    __decorate([
        typeorm_1.BeforeUpdate()
    ], Product.prototype, "checkSlugToUpdateInsert");
    Product = __decorate([
        typeorm_1.Entity({ name: 'products' })
    ], Product);
    return Product;
}());
exports.Product = Product;
