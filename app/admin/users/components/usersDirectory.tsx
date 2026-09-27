"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { FilterButton } from "./filterButton";
import { UsersTable } from "./usersTable";
import { useAdminUsers } from "../useAdminUsers";

export const UsersDirectory = () => {
  const [search, setSearch] = useState("");
  const { users, total, isLoading, errorMessage } = useAdminUsers(search.trim());

  return (
    <>
      <div className="flex items-center gap-3">
        <Input
          icon="search"
          placeholder="Search users"
          className="w-60"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterButton>Role</FilterButton>
        <FilterButton>Organisation</FilterButton>
        {!errorMessage && (
          <span className="ml-auto text-xs text-slate-400">
            {total} {total === 1 ? "user" : "users"}
          </span>
        )}
      </div>
      <UsersTable users={users} isLoading={isLoading} errorMessage={errorMessage} />
    </>
  );
};
