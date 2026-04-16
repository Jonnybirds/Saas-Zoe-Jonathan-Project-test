import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DecisionFactorInputDto {
  @IsString()
  factorKey!: string;

  @IsString()
  label!: string;

  @IsString()
  value!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  weight!: number;

  @IsIn(['positive', 'negative'])
  direction!: 'positive' | 'negative';
}

export class CreateAIDecisionDto {
  @IsString()
  useCase!: string;

  @IsString()
  subjectType!: string;

  @IsString()
  subjectId!: string;

  @IsObject()
  @IsOptional()
  context?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DecisionFactorInputDto)
  factors!: DecisionFactorInputDto[];
}
