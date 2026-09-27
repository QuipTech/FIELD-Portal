"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { configurationSnapshots } from "@/lib/mockData/configurationHistory";

const MAX_COMPARE_SELECTION = 2;

export const SnapshotsPanel = () => {
  const [selectedSnapshots, setSelectedSnapshots] = useState<string[]>(["snap-1", "snap-3"]);

  const toggleSnapshot = (id: string) => {
    setSelectedSnapshots((current) => {
      if (current.includes(id)) {
        return current.filter((selectedId) => selectedId !== id);
      }
      if (current.length >= MAX_COMPARE_SELECTION) {
        return [...current.slice(1), id];
      }
      return [...current, id];
    });
  };

  return (
    <div className="flex flex-[1.05] flex-col gap-2.5">
      <div className="flex items-baseline">
        <h2 className="text-base font-medium text-ink">Snapshots</h2>
        <span className="ml-auto text-xs text-mutedGray">Select two to compare</span>
      </div>
      <Table>
        <TableHeaderRow>
          <TableHeaderCell flex={0.4}>Cmp</TableHeaderCell>
          <TableHeaderCell flex={1.2}>Date</TableHeaderCell>
          <TableHeaderCell>Taken by</TableHeaderCell>
          <TableHeaderCell flex={1.3}>Trigger</TableHeaderCell>
        </TableHeaderRow>
        {configurationSnapshots.map((snapshot) => {
          const isSelected = selectedSnapshots.includes(snapshot.id);
          return (
            <TableRow
              key={snapshot.id}
              onClick={() => toggleSnapshot(snapshot.id)}
              className={`cursor-pointer transition-colors ${
                isSelected ? "bg-primaryTint" : "hover:bg-surfaceGray"
              }`}
            >
              <TableCell flex={0.4}>
                <span
                  className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full ${
                    isSelected ? "bg-primary text-white" : "border border-borderGrayStrong"
                  }`}
                >
                  {isSelected ? <Icon name="check" className="h-3 w-3" /> : null}
                </span>
              </TableCell>
              <TableCell flex={1.2} className={isSelected ? "font-medium" : undefined}>
                {snapshot.dateLabel}
              </TableCell>
              <TableCell className="flex items-center gap-2">
                {snapshot.takenBy !== "System" ? (
                  <Avatar
                    initials={snapshot.takenBy
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                    size="sm"
                  />
                ) : null}
                {snapshot.takenBy}
              </TableCell>
              <TableCell flex={1.3}>
                <Tag>{snapshot.trigger}</Tag>
              </TableCell>
            </TableRow>
          );
        })}
      </Table>
      <div className="flex items-center">
        <Button variant="primary" disabled={selectedSnapshots.length < MAX_COMPARE_SELECTION}>
          <Icon name="diff" />
          Compare selected ({selectedSnapshots.length})
        </Button>
        <Tag className="ml-auto">
          Last known good
          <Icon name="chevd" className="h-3.5 w-3.5" />
        </Tag>
      </div>
    </div>
  );
};
