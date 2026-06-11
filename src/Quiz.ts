import strokeMatches, { StrokeMatchResultMeta } from './strokeMatches';
import UserStroke from './models/UserStroke';
import Positioner from './Positioner';
import { counter, colorStringToVals, fixIndex } from './utils';
import * as quizActions from './quizActions';
import * as geometry from './geometry';
import * as characterActions from './characterActions';
import Character from './models/Character';
import { ParsedHanziWriterOptions, Point, StrokeData } from './typings/types';
import RenderState from './RenderState';
import { GenericMutation } from './Mutation';

/**
 * Thin wrapper around strokeMatches that also returns avgDist,
 * used by randomOrder mode to find the closest-matching stroke.
 */
const strokeMatchesWithDist = (
  userStroke: UserStroke,
  character: Character,
  strokeIndex: number,
  options: { isOutlineVisible?: boolean; leniency?: number; averageDistanceThreshold?: number },
): { isMatch: boolean; avgDist: number } => {
  // strokeMatches itself doesn't expose avgDist publicly, so we call it and
  // approximate avgDist via the Stroke's getAverageDistance helper.
  const result = strokeMatches(userStroke, character, strokeIndex, options);
  const avgDist = character.strokes[strokeIndex].getAverageDistance(userStroke.points);
  return { isMatch: result.isMatch, avgDist };
};

const getDrawnPath = (userStroke: UserStroke) => ({
  pathString: geometry.getPathString(userStroke.externalPoints),
  points: userStroke.points.map((point) => geometry.round(point)),
});

export default class Quiz {
  _character: Character;
  _renderState: RenderState;
  _isActive: boolean;
  _positioner: Positioner;

  /** Set on startQuiz */
  _options: ParsedHanziWriterOptions | undefined;
  _currentStrokeIndex = 0;
  _mistakesOnStroke = 0;
  _totalMistakes = 0;
  _userStroke: UserStroke | undefined;
  _userStrokesIds: Array<number> | undefined;

  // randomOrder mode state
  /** Stroke indices already lit, in draw order (randomOrder mode only) */
  _randomOrderLitStrokes: number[] = [];

  constructor(character: Character, renderState: RenderState, positioner: Positioner) {
    this._character = character;
    this._renderState = renderState;
    this._isActive = false;
    this._positioner = positioner;
  }

  startQuiz(options: ParsedHanziWriterOptions) {
    if (this._userStrokesIds) {
      this._renderState.run(
        quizActions.removeAllUserStrokes( this._userStrokesIds ),
      );
    }
    this._userStrokesIds = []

    this._isActive = true;
    this._options = options;
    this._randomOrderLitStrokes = [];

    const startIndex = fixIndex(
      options.quizStartStrokeNum,
      this._character.strokes.length,
    );
    this._currentStrokeIndex = Math.min(startIndex, this._character.strokes.length - 1);
    this._mistakesOnStroke = 0;
    this._totalMistakes = 0;

    const initMutations = options.randomOrder
      ? quizActions.startRandomOrderQuiz(this._character)
      : quizActions.startQuiz(
          this._character,
          options.strokeFadeDuration,
          this._currentStrokeIndex,
        );

    return this._renderState.run(initMutations);
  }

  startUserStroke(externalPoint: Point) {
    if (!this._isActive) {
      return null;
    }
    if (this._userStroke) {
      return this.endUserStroke();
    }
    const point = this._positioner.convertExternalPoint(externalPoint);
    const strokeId = counter();
    this._userStroke = new UserStroke(strokeId, point, externalPoint);
    this._userStrokesIds?.push(strokeId)
    return this._renderState.run(quizActions.startUserStroke(strokeId, point));
  }

  continueUserStroke(externalPoint: Point) {
    if (!this._userStroke) {
      return Promise.resolve();
    }
    const point = this._positioner.convertExternalPoint(externalPoint);
    this._userStroke.appendPoint(point, externalPoint);
    const nextPoints = this._userStroke.points.slice(0);
    return this._renderState.run(
      quizActions.updateUserStroke(this._userStroke.id, nextPoints),
    );
  }

  setPositioner(positioner: Positioner) {
    this._positioner = positioner;
  }

  endUserStroke() {
    if (!this._userStroke) return;

    this._renderState.run(
      quizActions.hideUserStroke(
        this._userStroke.id,
        this._options!.drawingFadeDuration ?? 300,
      ),
    );

    // skip single-point strokes
    if (this._userStroke.points.length === 1) {
      this._userStroke = undefined;
      return;
    }

    if (this._options!.randomOrder) {
      this._handleRandomOrderStroke();
    } else {
      this._handleOrderedStroke();
    }

    this._userStroke = undefined;
  }

  cancel() {
    this._isActive = false;
    if (this._userStrokesIds) {
      this._renderState.run(
        quizActions.removeAllUserStrokes( this._userStrokesIds ),
      );
    }
  }

  _getStrokeData({
    isCorrect,
    meta,
  }: {
    isCorrect: boolean;
    meta: StrokeMatchResultMeta;
  }): StrokeData {
    return {
      character: this._character.symbol,
      strokeNum: this._currentStrokeIndex,
      mistakesOnStroke: this._mistakesOnStroke,
      totalMistakes: this._totalMistakes,
      strokesRemaining:
        this._character.strokes.length - this._currentStrokeIndex - (isCorrect ? 1 : 0),
      drawnPath: getDrawnPath(this._userStroke!),
      isBackwards: meta.isStrokeBackwards,
    };
  }

  nextStroke() {
    if (!this._options) return;

    const { strokes, symbol } = this._character;

    const {
      onComplete,
      highlightOnComplete,
      strokeFadeDuration,
      highlightCompleteColor,
      highlightColor,
      strokeHighlightDuration,
    } = this._options;

    let animation: GenericMutation[] = characterActions.showStroke(
      'main',
      this._currentStrokeIndex,
      strokeFadeDuration,
    );

    this._mistakesOnStroke = 0;
    this._currentStrokeIndex += 1;

    const isComplete = this._currentStrokeIndex === strokes.length;

    if (isComplete) {
      this._isActive = false;
      onComplete?.({
        character: symbol,
        totalMistakes: this._totalMistakes,
      });
      if (highlightOnComplete) {
        animation = animation.concat(
          quizActions.highlightCompleteChar(
            this._character,
            colorStringToVals(highlightCompleteColor || highlightColor),
            (strokeHighlightDuration || 0) * 2,
          ),
        );
      }
    }

    this._renderState.run(animation);
  }

  /** Original ordered-quiz stroke handling (unchanged behavior). */
  _handleOrderedStroke() {
    const { acceptBackwardsStrokes, markStrokeCorrectAfterMisses } = this._options!;

    const currentStroke = this._getCurrentStroke();
    const { isMatch, meta } = strokeMatches(
      this._userStroke!,
      this._character,
      this._currentStrokeIndex,
      {
        isOutlineVisible: this._renderState.state.character.outline.opacity > 0,
        leniency: this._options!.leniency,
        averageDistanceThreshold: this._options!.averageDistanceThreshold,
      },
    );

    const isForceAccepted =
      markStrokeCorrectAfterMisses &&
      this._mistakesOnStroke + 1 >= markStrokeCorrectAfterMisses;

    const isAccepted =
      isMatch || isForceAccepted || (meta.isStrokeBackwards && acceptBackwardsStrokes);

    if (isAccepted) {
      this._handleSuccess(meta);
    } else {
      this._handleFailure(meta);

      const { showHintAfterMisses, highlightColor, strokeHighlightSpeed } = this._options!;

      if (
        showHintAfterMisses !== false &&
        this._mistakesOnStroke >= showHintAfterMisses
      ) {
        this._renderState.run(
          characterActions.highlightStroke(
            currentStroke,
            colorStringToVals(highlightColor),
            strokeHighlightSpeed,
          ),
        );
      }
    }
  }

  /**
   * Random-order quiz stroke handling.
   * Matches the user stroke against ALL not-yet-lit strokes and lights the closest one.
   * Collects draw order in _randomOrderLitStrokes; fires onComplete when all strokes are lit.
   */
  _handleRandomOrderStroke() {
    const { strokes, symbol } = this._character;
    const isOutlineVisible = this._renderState.state.character.outline.opacity > 0;
    const { leniency, averageDistanceThreshold, strokeFadeDuration, onComplete } =
      this._options!;

    // Find the best-matching not-yet-lit stroke
    let bestStrokeIndex = -1;
    let bestAvgDist = Infinity;

    for (let i = 0; i < strokes.length; i++) {
      if (this._randomOrderLitStrokes.indexOf(i) !== -1) continue; // already lit

      const { isMatch, avgDist } = strokeMatchesWithDist(
        this._userStroke!,
        this._character,
        i,
        { isOutlineVisible, leniency, averageDistanceThreshold },
      );

      if (isMatch && avgDist < bestAvgDist) {
        bestAvgDist = avgDist;
        bestStrokeIndex = i;
      }
    }

    if (bestStrokeIndex === -1) {
      // No match — silently ignore (no mistake counted, no hint shown)
      return;
    }

    // Light the matched stroke
    this._randomOrderLitStrokes.push(bestStrokeIndex);
    this._renderState.run(
      characterActions.showStroke('main', bestStrokeIndex, strokeFadeDuration),
    );

    // Check completion
    if (this._randomOrderLitStrokes.length === strokes.length) {
      this._isActive = false;
      onComplete?.({
        character: symbol,
        totalMistakes: 0,
        userStrokeOrder: [...this._randomOrderLitStrokes],
      });
    }
  }

  _handleSuccess(meta: StrokeMatchResultMeta) {
    if (!this._options) return;

    const { onCorrectStroke } = this._options;

    onCorrectStroke?.({
      ...this._getStrokeData({ isCorrect: true, meta }),
    });

    this.nextStroke();
  }

  _handleFailure(meta: StrokeMatchResultMeta) {
    this._mistakesOnStroke += 1;
    this._totalMistakes += 1;
    this._options!.onMistake?.(this._getStrokeData({ isCorrect: false, meta }));
  }

  _getCurrentStroke() {
    return this._character.strokes[this._currentStrokeIndex];
  }
}
