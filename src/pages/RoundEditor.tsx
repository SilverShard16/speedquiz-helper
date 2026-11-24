import { useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import QuestionInput from "../components/QuestionInput";
import { type Round, type EditorQuestion, type QuestionType, createEmptyQuestion } from "../models/Question";
import { exportRounds } from "../services/exportService";
import { getRoundKind, canUseQuestionType } from '../services/roundHelpers';
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { importRoundFiles, shouldCollapseImportedRounds, type RoundImportError } from "../services/roundImportService";

export default function RoundEditor() {
    const [rounds, setRounds] = useState<Round[]>([]);
    const [importing, setImporting] = useState(false);
    const [importErrors, setImportErrors] = useState<RoundImportError[]>([]);
    const [importNotice, setImportNotice] = useState<string | null>(null);
    const hasImportedBefore = useRef(false);
    const importBusy = useRef(false);

    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [collapsedRoundIds, setCollapsedRoundIds] = useState<Set<string>>(
        () => new Set()
    );

    const [addQuestionMenu, setAddQuestionMenu] = useState<{
        anchorEl: HTMLElement;
        roundId: string;
    } | null>(null);

    const exportLabel =
        rounds.length > 1
            ? "Export ZIP"
            : rounds.length === 1 &&
              getRoundKind(rounds[0]!.questions) === "nearest"
                ? "Export SQN"
                : "Export SQQ";

    const handleImportFiles = async (
        event: ChangeEvent<HTMLInputElement>
    ): Promise<void> => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        if (files.length === 0 || importBusy.current) return;

        importBusy.current = true;
        setImporting(true);
        setImportErrors([]);
        setImportNotice(null);

        try {
            const { rounds: imported, errors } = await importRoundFiles(files);
            setImportErrors(errors);

            if (imported.length > 0) {
                const collapseNew = shouldCollapseImportedRounds(
                    hasImportedBefore.current,
                    imported.length
                );

                setRounds(previous => [...previous, ...imported]);

                if (collapseNew) {
                    setCollapsedRoundIds(previous => {
                        const next = new Set(previous);
                        imported.forEach(round => next.add(round.id));
                        return next;
                    });
                }

                hasImportedBefore.current = true;
                setImportNotice(
                    `Imported ${imported.length} round${imported.length === 1 ? "" : "s"}.`
                );
            }
        } catch (error) {
            setImportErrors([{ filename: "Upload", message: error instanceof Error ? error.message : "Import failed." }]);
        } finally {
            importBusy.current = false;
            setImporting(false);
        }
    };

    const toggleRound = (roundId: string): void => {
        setCollapsedRoundIds(prev => {
            const next = new Set(prev);

            if (next.has(roundId)) {
                next.delete(roundId);
            } else {
                next.add(roundId);
            }

            return next;
        });
    };

    const collapseAllRounds = (): void => {
        setCollapsedRoundIds(
            new Set(rounds.map(round => round.id))
        );
    };

    const expandAllRounds = (): void => {
        setCollapsedRoundIds(new Set());
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
        event: MouseEvent<HTMLButtonElement>,
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

            case "normal": {
                addQuestion(roundId, "standard");
                break;
            }

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

                if (
                    !canUseQuestionType(
                        getRoundKind(round.questions),
                        type
                    )
                ) {
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
                if (round.id !== roundId) {
                    return round;
                }

                const existing = round.questions.find(
                    question =>
                        question.clientId === updatedQuestion.clientId
                );

                if (!existing) {
                    return round;
                }

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

    const removeRound = (roundId: string): void => {
        setRounds(prev =>
            prev.filter(round => round.id !== roundId)
        );

        setCollapsedRoundIds(prev => {
            const next = new Set(prev);
            next.delete(roundId);
            return next;
        });
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
                <Typography
                    variant="h1"
                    sx={{ fontSize: { xs: 36, md: 48 } }}
                >
                    Edit Existing Rounds
                </Typography>

                <Typography color="text.primary" sx={{ maxWidth: 600 }}>
                    Import existing SQQ and SQN rounds and edit their questions,
                    answers, pictures and titles.
                </Typography>

                <Typography color="text.primary" sx={{ maxWidth: 600 }}>
                    Import any number of files now, then add more whenever you like.
                </Typography>
            </Stack>

            <Stack spacing={2} sx={{ maxWidth: 660 }}>
                <Button
                    component="label"
                    variant="contained"
                    color="primary"
                    startIcon={<UploadFileIcon />}
                    disabled={importing || exporting}
                >
                    {importing ? "Importing..." : "Import SQQ / SQN Files"}
                    <input
                        hidden
                        type="file"
                        accept=".sqq,.sqn"
                        multiple
                        disabled={importing || exporting}
                        onChange={event => void handleImportFiles(event)}
                    />
                </Button>

                {importNotice && <Alert severity="success">{importNotice}</Alert>}

                {importErrors.length > 0 && (
                    <Alert severity="warning">
                        {importErrors.length} file(s) could not be imported:
                        <Box component="ul" sx={{ my: 1, pl: 3 }}>
                            {importErrors.map((error, index) => (
                                <li key={`${error.filename}-${index}`}>
                                    <strong>{error.filename}</strong>: {error.message}
                                </li>
                            ))}
                        </Box>
                    </Alert>
                )}

                {rounds.length === 0 && (
                    <Typography color="text.secondary" variant="body2">
                        No rounds loaded yet. Select one or more .sqq or .sqn files.
                    </Typography>
                )}

                <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="flex-end"
                >
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={collapseAllRounds}
                        disabled={
                            rounds.length === 0 ||
                            rounds.every(round =>
                                collapsedRoundIds.has(round.id)
                            )
                        }
                    >
                        Collapse All
                    </Button>

                    <Button
                        variant="outlined"
                        size="small"
                        onClick={expandAllRounds}
                        disabled={collapsedRoundIds.size === 0}
                    >
                        Expand All
                    </Button>
                </Stack>
                {rounds.map((round, roundIndex) => {
                    const roundKind = getRoundKind(round.questions);
                    const isCollapsed = collapsedRoundIds.has(round.id);

                    return (
                        <Card
                            key={round.id}
                            sx={{
                                width: "100%",
                                borderRadius: 3
                            }}
                        >
                            <Box sx={{ p: { xs: 2, sm: 3 } }}>
                                <Stack
                                    direction="row"
                                    spacing={2}
                                    alignItems="center"
                                >
                                    <TextField
                                        label={`Round ${roundIndex + 1}`}
                                        value={round.title}
                                        size="small"
                                        fullWidth
                                        onChange={event =>
                                            updateRoundTitle(
                                                round.id,
                                                event.target.value
                                            )
                                        }
                                    />

                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            whiteSpace: "nowrap"
                                        }}
                                    >
                                        {round.questions.length} Questions
                                    </Typography>

                                    <Chip
                                        size="small"
                                        variant="outlined"
                                        label={
                                            roundKind === "nearest"
                                                ? "Nearest Wins"
                                                : roundKind === "normal"
                                                    ? "Standard"
                                                    : roundKind === "empty"
                                                        ? "Empty"
                                                        : "Mixed"
                                        }
                                    />

                                    <Tooltip
                                        title={
                                            isCollapsed
                                                ? "Expand Round"
                                                : "Collapse Round"
                                        }
                                    >
                                        <IconButton
                                            onClick={() => toggleRound(round.id)}
                                            aria-label={
                                                isCollapsed
                                                    ? "Expand round"
                                                    : "Collapse round"
                                            }
                                            aria-expanded={!isCollapsed}
                                            aria-controls={`round-content-${round.id}`}
                                        >
                                            <ExpandMoreIcon
                                                sx={{
                                                    transform: isCollapsed
                                                        ? "rotate(-90deg)"
                                                        : "rotate(0deg)",
                                                    transition: theme =>
                                                        theme.transitions.create(
                                                            "transform",
                                                            {
                                                                duration:
                                                                    theme.transitions.duration.shortest
                                                            }
                                                        )
                                                }}
                                            />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Box>

                            <Collapse
                                in={!isCollapsed}
                                timeout="auto"
                            >
                                <Divider />

                                <CardContent
                                    id={`round-content-${round.id}`}
                                    sx={{
                                        p: { xs: 2, sm: 3 },
                                        "&:last-child": {
                                            pb: { xs: 2, sm: 3 }
                                        }
                                    }}
                                >
                                    <Stack spacing={2}>
                                        {round.questions.map(
                                            (question, questionIndex) => (
                                                <QuestionInput
                                                    key={question.clientId}
                                                    question={question}
                                                    questionNumber={questionIndex}
                                                    roundKind={roundKind}
                                                    onChange={updated =>
                                                        updateQuestion(
                                                            round.id,
                                                            updated
                                                        )
                                                    }
                                                    onRemove={() =>
                                                        removeQuestion(
                                                            round.id,
                                                            question.clientId
                                                        )
                                                    }
                                                />
                                            )
                                        )}

                                        <Stack
                                            direction="row"
                                            justifyContent="space-between"
                                            alignItems="center"
                                        >
                                            <Button
                                                variant="text"
                                                color="error"
                                                onClick={() =>
                                                    removeRound(round.id)
                                                }
                                            >
                                                Remove Round
                                            </Button>

                                            <Button
                                                variant="text"
                                                onClick={event =>
                                                    handleAddQuestion(
                                                        event,
                                                        round.id
                                                    )
                                                }
                                            >
                                                + Add Question
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Collapse>
                        </Card>
                    );
                })}
            </Stack>
            <Stack spacing={2} sx={{ maxWidth: 660 }}>
              <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={<DownloadIcon />}
                  disabled={
                      exporting ||
                      importing ||
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
