"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { cat793fSystemTree } from "@/lib/mockData/adminMachineLibrary";

export const SystemTree = () => {
  const [expandedName, setExpandedName] = useState<string | undefined>(cat793fSystemTree[0]?.name);

  return (
    <div className="flex flex-col gap-3.5">
      <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
        System &amp; component tree — CAT 793F
      </span>
      <div className="flex flex-col gap-3">
        {cat793fSystemTree.map((branch) => {
          const expanded = branch.name === expandedName;
          return (
            <div key={branch.name} className="flex flex-col gap-2">
              <button
                onClick={() => setExpandedName(expanded ? undefined : branch.name)}
                className="flex items-center gap-2"
              >
                <Icon name={expanded ? "chevd" : "chevr"} className="stroke-bodyGray" />
                <span className="text-[15px] font-medium text-ink">{branch.name}</span>
                <span className="ml-auto text-xs text-mutedGray">{branch.componentCount} components</span>
              </button>
              {expanded && branch.components ? (
                <div className="flex flex-col gap-2 pl-[26px]">
                  {branch.components.map((component) => (
                    <div key={component} className="flex items-center gap-2">
                      <Icon name="layers" className="h-3.5 w-3.5 stroke-mutedGray" />
                      <span className="text-[15px] text-bodyGray">{component}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2.5">
        <Button>
          <Icon name="plus" />
          Add system
        </Button>
        <Button>
          <Icon name="upload" />
          Import tree
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">Reused by every asset instance of the model.</p>
    </div>
  );
};
