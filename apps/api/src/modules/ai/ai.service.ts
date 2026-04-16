import { Injectable, NotFoundException } from '@nestjs/common';
import { AIRunStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { CreateAIDecisionDto, DecisionFactorInputDto } from './dto';

interface ScoredFactor {
  factorKey: string;
  label: string;
  value: string;
  weight: number;
  impact: number;
  direction: 'positive' | 'negative';
  rationale: string;
}

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  async createDecision(user: RequestUser, payload: CreateAIDecisionDto) {
    const scoredFactors = this.scoreFactors(payload.factors);
    const netImpact = scoredFactors.reduce((acc, factor) => acc + factor.impact, 0);

    const confidence = this.bound01(0.5 + Math.abs(netImpact));
    const requiresHumanReview = confidence < 0.82 || netImpact < 0;
    const status = requiresHumanReview
      ? AIRunStatus.NEEDS_REVIEW
      : AIRunStatus.SUCCEEDED;

    const recommendationCode = netImpact >= 0 ? 'APPROVE_WITH_MONITORING' : 'DECLINE_OR_ESCALATE';
    const recommendationLabel = netImpact >= 0 ? 'Approve with Monitoring' : 'Decline or Escalate';

    const topFactors = [...scoredFactors]
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 3)
      .map((factor) => `${factor.label}: ${factor.rationale}`)
      .join('; ');

    const rationaleSummary =
      topFactors || 'Insufficient decision signal quality; fallback to manual review.';

    const aiRun = await this.prisma.$transaction(async (tx) => {
      const run = await tx.aIRun.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.sub,
          useCase: payload.useCase,
          subjectType: payload.subjectType,
          subjectId: payload.subjectId,
          status,
          modelVersion: 'risk-fusion-v1.0.0',
          promptVersion: 'decision-policy-v1.0.0',
          inputJson: {
            context: payload.context ?? {},
            factors: payload.factors,
          },
          confidence: new Prisma.Decimal(confidence),
          rationaleSummary,
          factors: {
            create: scoredFactors.map((factor) => ({
              factorKey: factor.factorKey,
              label: factor.label,
              value: factor.value,
              weight: new Prisma.Decimal(factor.weight),
              impact: new Prisma.Decimal(factor.impact),
              direction: factor.direction,
              rationale: factor.rationale,
            })),
          },
          recommendation: {
            create: {
              recommendationCode,
              recommendationLabel,
              reasonCode: requiresHumanReview
                ? 'LOW_CONFIDENCE_OR_NEGATIVE_NET_IMPACT'
                : 'HIGH_CONFIDENCE_POSITIVE_NET_IMPACT',
              reasonText: rationaleSummary,
              requiresHumanReview,
            },
          },
        },
        include: {
          recommendation: true,
          factors: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.sub,
          action: 'ai.decision.created',
          entityType: 'ai_run',
          entityId: run.id,
          metadata: {
            useCase: payload.useCase,
            subjectType: payload.subjectType,
            subjectId: payload.subjectId,
            confidence,
            requiresHumanReview,
            recommendationCode,
          },
        },
      });

      return run;
    });

    return {
      aiRunId: aiRun.id,
      status: aiRun.status,
      confidence: Number(aiRun.confidence),
      modelVersion: aiRun.modelVersion,
      promptVersion: aiRun.promptVersion,
      explainability: {
        summary: aiRun.rationaleSummary,
        factors: aiRun.factors.map((factor) => ({
          factorKey: factor.factorKey,
          label: factor.label,
          value: factor.value,
          direction: factor.direction,
          weight: Number(factor.weight),
          impact: Number(factor.impact),
          rationale: factor.rationale,
        })),
      },
      recommendation: aiRun.recommendation,
      audit: {
        action: 'ai.decision.created',
        entityType: 'ai_run',
        entityId: aiRun.id,
      },
    };
  }

  async getDecision(user: RequestUser, aiRunId: string) {
    const aiRun = await this.prisma.aIRun.findFirst({
      where: { id: aiRunId, tenantId: user.tenantId },
      include: {
        recommendation: true,
        factors: true,
      },
    });

    if (!aiRun) {
      throw new NotFoundException('AI decision run not found');
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.sub,
        action: 'ai.decision.viewed',
        entityType: 'ai_run',
        entityId: aiRun.id,
        metadata: {
          confidence: Number(aiRun.confidence),
          status: aiRun.status,
        },
      },
    });

    return {
      aiRunId: aiRun.id,
      useCase: aiRun.useCase,
      subjectType: aiRun.subjectType,
      subjectId: aiRun.subjectId,
      status: aiRun.status,
      confidence: Number(aiRun.confidence),
      modelVersion: aiRun.modelVersion,
      promptVersion: aiRun.promptVersion,
      explainability: {
        summary: aiRun.rationaleSummary,
        factors: aiRun.factors.map((factor) => ({
          factorKey: factor.factorKey,
          label: factor.label,
          value: factor.value,
          direction: factor.direction,
          weight: Number(factor.weight),
          impact: Number(factor.impact),
          rationale: factor.rationale,
        })),
      },
      recommendation: aiRun.recommendation,
    };
  }

  private scoreFactors(factors: DecisionFactorInputDto[]): ScoredFactor[] {
    return factors.map((factor) => {
      const directionMultiplier = factor.direction === 'positive' ? 1 : -1;
      const normalizedWeight = this.bound01(factor.weight);
      const impact = directionMultiplier * normalizedWeight;

      return {
        factorKey: factor.factorKey,
        label: factor.label,
        value: factor.value,
        weight: normalizedWeight,
        impact,
        direction: factor.direction,
        rationale:
          factor.direction === 'positive'
            ? `${factor.label} improved expected risk posture with weighted confidence ${normalizedWeight.toFixed(2)}.`
            : `${factor.label} worsened expected risk posture with weighted confidence ${normalizedWeight.toFixed(2)}.`,
      };
    });
  }

  private bound01(value: number) {
    return Math.max(0, Math.min(1, value));
  }
}
