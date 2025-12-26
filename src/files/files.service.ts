import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';


@Injectable()
export class FilesService {
 
  
  getStaticFile(fileName: string) {
    const path = join(__dirname, '../../static/uploads', fileName);

    if ( !existsSync(path)) 
        throw new BadRequestException(`No product found with image ${ fileName }`)

    return path;
  }  

  deleteFile(fileName: string) {
    const path = join(__dirname, '../../static/uploads', fileName);
    if ( !existsSync(path)) 
        throw new BadRequestException(`No product found with image ${ fileName }`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      fs.unlinkSync(path);
      return { message: `File ${ fileName } deleted successfully` };
    } catch (error) {
      throw new BadRequestException(`Error deleting file ${ fileName }: ${ error.message }`);
    }
  } 
}
