
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";

import QuestionInput from "../components/QuestionInput";
import { type Round, type EditorQuestion, type QuestionType, createEmptyQuestion } from "../models/Question";
import { exportRounds } from "../services/exportService";
import { getRoundKind, canUseQuestionType } from '../services/roundHelpers';
import DownloadIcon from "@mui/icons-material/Download";

export default function QuestionManager() {
    const [rounds, setRounds] = useState<Round[]>(() => [
        {
            id: crypto.randomUUID(),
            title: "Round 1",
            questions: []
        }
    ]);

    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    const [addQuestionMenu, setAddQuestionMenu] = useState<{
        anchorEl: HTMLElement;
        roundId: string;
    } | null>(null);

    const exportLabel =
        rounds.length > 1
            ? "Export ZIP"
            : rounds.length === 1 &&
              getRoundKind(rounds[0].questions) === "nearest"
                ? "Export SQN"
                : "Export SQQ";

    const selectedRound = rounds.find(
        round => round.id === addQuestionMenu?.roundId
    );

    const selectedRoundKind = selectedRound
        ? getRoundKind(selectedRound.questions)
        : "mixed";

    const addRound = () => {
        setRounds(prev => [
            ...prev,
            {
                id: crypto.randomUUID(),
                title: `Round ${prev.length + 1}`,
                questions: []
            }
        ]);
    };

    const updateRoundTitle = (
        roundId: string,
        title: string
    ) => {
        setRounds(prev =>
            prev.map(round =>
                round.id === roundId
                    ? { ...round, title }
                    : round
            )
        );
    };

    const handleAddQuestion = (
        event: React.MouseEvent<HTMLButtonElement>,
        roundId: string
    ) => {
        const round = rounds.find(round => round.id === roundId);

        if (!round) return;

        const roundKind = getRoundKind(round.questions);

        switch (roundKind) {
            case "empty":
                setAddQuestionMenu({
                    anchorEl: event.currentTarget,
                    roundId
                });
                break;

            case "normal":
                addQuestion(roundId, "standard");
                break;

            case "nearest":
                addQuestion(roundId, "nearest");
                break;

            case "mixed":
                console.error(
                    "Round contains incompatible question types."
                );
                break;
        }
    };

    const addQuestion = (
        roundId: string,
        type: QuestionType
    ) => {
        setRounds(prev =>
            prev.map(round => {
                if (round.id !== roundId) {
                    return round;
                }

                const roundKind = getRoundKind(round.questions);

                if (!canUseQuestionType(roundKind, type)) {
                    return round;
                }

                return {
                    ...round,
                    questions: [
                        ...round.questions,
                        createEmptyQuestion(type)
                    ]
                };
            })
        );
    };

    const updateQuestion = (
        roundId: string,
        updatedQuestion: EditorQuestion
    ) => {
        setRounds(prev =>
            prev.map(round => {
                if (round.id !== roundId) return round;

                const existing = round.questions.find(
                    q => q.clientId === updatedQuestion.clientId
                );

                if (!existing) return round;

                if (
                    existing.type !== updatedQuestion.type &&
                    !canUseQuestionType(
                        getRoundKind(round.questions),
                        updatedQuestion.type
                    )
                ) {
                    return round;
                }

                return {
                    ...round,
                    questions: round.questions.map(question =>
                        question.clientId === updatedQuestion.clientId
                            ? updatedQuestion
                            : question
                    )
                };
            })
        );
    };

    const removeQuestion = (
        roundId: string,
        questionId: string
    ) => {
        setRounds(prev =>
            prev.map(round =>
                round.id === roundId
                    ? {
                        ...round,
                        questions: round.questions.filter(
                            question => question.clientId !== questionId
                        )
                    }
                    : round
            )
        );
    };
    
    const handleExport = async () => {
      setExporting(true);
      setExportError(null);

      try {
          await exportRounds(rounds);
      } catch (error) {
          setExportError(
              error instanceof Error
                  ? error.message
                  : "Failed to export rounds."
          );
      } finally {
          setExporting(false);
      }
    };

    return (
        <Stack spacing={4}>
            <Stack spacing={2} alignItems="flex-start">
                <Chip
                    label="Example Chip"
                    color="primary"
                    variant="outlined"
                />

                <Typography
                    variant="h1"
                    sx={{ fontSize: { xs: 36, md: 48 } }}
                >
                    Question Manager
                </Typography>

                <Typography color="text.primary" sx={{ maxWidth: 600 }}>
                    A handy question manager where adding new questions
                    is simple and easy.
                </Typography>

                <Typography color="text.primary" sx={{ maxWidth: 600 }}>
                    Easily separate questions into rounds.
                </Typography>
            </Stack>

            <Stack spacing={2} sx={{ maxWidth: 660 }}>
                {rounds.map((round, roundIndex) => (
                    <Card
                        key={round.id}
                        sx={{
                            width: "100%",
                            borderRadius: 3
                        }}
                    >
                        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                            <Stack spacing={2}>
                                <TextField
                                    label={`Round ${roundIndex + 1}`}
                                    value={round.title}
                                    onChange={event =>
                                        updateRoundTitle(
                                            round.id,
                                            event.target.value
                                        )
                                    }
                                />

                                <Stack spacing={2}>
                                    {rounds.map((round, roundIndex) => {
                                        const roundKind = getRoundKind(round.questions);

                                        return (
                                            <Card key={round.id}>
                                                <CardContent>
                                                    {round.questions.map((question, questionIndex) => (
                                                        <QuestionInput
                                                            key={question.clientId}
                                                            question={question}
                                                            questionNumber={questionIndex}
                                                            roundKind={roundKind}
                                                            onChange={updated =>
                                                                updateQuestion(round.id, updated)
                                                            }
                                                            onRemove={() =>
                                                                removeQuestion(round.id, question.clientId)
                                                            }
                                                        />
                                                    ))}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}

                                    <Button
                                        variant="text"
                                        sx={{ alignSelf: "flex-end" }}
                                        onClick={(event) =>
                                            handleAddQuestion(event, round.id)
                                        }
                                    >
                                        + Add Question
                                    </Button>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                ))}

                <Button
                    variant="text"
                    sx={{ alignSelf: "flex-end" }}
                    onClick={addRound}
                >
                    + Add Round
                </Button>
            </Stack>
            <Stack spacing={2} sx={{ maxWidth: 660 }}>
              <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={<DownloadIcon />}
                  disabled={
                      exporting ||
                      rounds.length === 0 ||
                      rounds.some(round =>
                          ["empty", "mixed"].includes(
                              getRoundKind(round.questions)
                          )
                      )
                  }
                  onClick={handleExport}
              >
                  {exporting ? "Exporting..." : exportLabel}
              </Button>

              {exportError && (
                  <Alert
                    severity="error"
                    variant="outlined"
                    sx={{ maxWidth: 660, borderRadius: 2 }}
                    >
                      {exportError}
                  </Alert>
              )}
          </Stack>
          <Menu
              anchorEl={addQuestionMenu?.anchorEl}
              open={Boolean(addQuestionMenu)}
              onClose={() => setAddQuestionMenu(null)}
          >
              <MenuItem
                  onClick={() => {
                      if (addQuestionMenu) {
                          addQuestion(
                              addQuestionMenu.roundId,
                              "standard"
                          );
                      }

                      setAddQuestionMenu(null);
                  }}
              >
                  Standard Question
              </MenuItem>

              <MenuItem
                  onClick={() => {
                      if (addQuestionMenu) {
                          addQuestion(
                              addQuestionMenu.roundId,
                              "nearest"
                          );
                      }

                      setAddQuestionMenu(null);
                  }}
              >
                  Nearest Win
              </MenuItem>
          </Menu>
        </Stack>
    );
}
