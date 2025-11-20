import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Search, User, Users, Network } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  ecell_id: string | null;
  title: string | null;
  role: string;
  department: string | null;
  photo_url: string | null;
  year: number;
}

interface HierarchyNode {
  id: string;
  user_id: string;
  title: string;
  department: string | null;
  parent_id: string | null;
  meta: any;
  profile?: Profile;
  children?: HierarchyNode[];
}

const Organization = () => {
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("org-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hierarchy" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [hierarchyResult, profilesResult] = await Promise.all([
        supabase.from("hierarchy").select("*").order("title"),
        supabase.from("profiles").select("*").order("ecell_id"),
      ]);

      if (hierarchyResult.error) throw hierarchyResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const hierarchyData = hierarchyResult.data || [];
      const profilesData = profilesResult.data || [];

      setProfiles(profilesData);

      const profileMap = new Map(profilesData.map((p) => [p.id, p]));
      const nodesWithProfiles = hierarchyData.map((node) => ({
        ...node,
        profile: profileMap.get(node.user_id),
      }));

      const tree = buildTree(nodesWithProfiles);
      setHierarchy(tree);

      const uniqueDepts = [...new Set(profilesData.map((p) => p.department).filter(Boolean))] as string[];
      setDepartments(uniqueDepts);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load organization data");
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (nodes: HierarchyNode[]): HierarchyNode[] => {
    const nodeMap = new Map<string, HierarchyNode>();
    const rootNodes: HierarchyNode[] = [];

    // First pass: create all nodes
    nodes.forEach((node) => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    // Second pass: build parent-child relationships
    nodes.forEach((node) => {
      const currentNode = nodeMap.get(node.id);
      if (!currentNode) return;

      if (node.parent_id && nodeMap.has(node.parent_id)) {
        const parent = nodeMap.get(node.parent_id);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(currentNode);
        }
      } else {
        rootNodes.push(currentNode);
      }
    });

    return rootNodes;
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const filterNodes = (nodes: HierarchyNode[]): HierarchyNode[] => {
    return nodes
      .map((node) => {
        const profile = node.profile;
        if (!profile) return null;

        const matchesSearch =
          !searchQuery ||
          profile.ecell_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          profile.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.title.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDepartment =
          departmentFilter === "all" || profile.department === departmentFilter;

        if (!matchesSearch || !matchesDepartment) return null;

        const filteredChildren = node.children ? filterNodes(node.children) : [];
        return { ...node, children: filteredChildren };
      })
      .filter(Boolean) as HierarchyNode[];
  };

  const renderNode = (node: HierarchyNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const profile = node.profile;

    if (!profile) return null;

    return (
      <div key={node.id} className="relative">
        {level > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 w-px bg-zinc-800"
            style={{ left: `${(level * 24) - 12}px` }}
          />
        )}
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg transition-all duration-200 border border-transparent",
            "hover:bg-zinc-800/50 hover:border-zinc-700",
            isExpanded && hasChildren ? "bg-zinc-900/30" : ""
          )}
          style={{ marginLeft: `${level * 24}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleNode(node.id)}
              className="flex-shrink-0 hover:bg-primary/20 hover:text-primary p-1 rounded transition-colors text-gray-400"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          <Avatar className="h-10 w-10 border border-zinc-700">
            <AvatarImage src={profile.photo_url || ""} />
            <AvatarFallback className="bg-zinc-800 text-gray-400">
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white">{node.title}</span>
              <Badge variant="outline" className="text-xs border-zinc-700 text-primary">
                {profile.role}
              </Badge>
              {profile.department && (
                <Badge variant="secondary" className="text-xs bg-zinc-800 text-gray-300 hover:bg-zinc-700">
                  {profile.department}
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {profile.ecell_id || "No ID"} • Year {profile.year}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredHierarchy = filterNodes(hierarchy);

  return (
    <div className="min-h-screen bg-black pb-12">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Organization</h1>
            <p className="text-gray-400">View team hierarchy and members</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (expandedNodes.size > 0) {
                  setExpandedNodes(new Set());
                } else {
                  const allIds = new Set<string>();
                  const collectIds = (nodes: HierarchyNode[]) => {
                    nodes.forEach((node) => {
                      allIds.add(node.id);
                      if (node.children) collectIds(node.children);
                    });
                  };
                  collectIds(hierarchy);
                  setExpandedNodes(allIds);
                }
              }}
              className="border-zinc-700 text-gray-300 hover:bg-zinc-800 hover:text-white"
            >
              <Network className="h-4 w-4 mr-2" />
              {expandedNodes.size > 0 ? "Collapse All" : "Expand All"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Users className="h-5 w-5 text-primary" />
                  Hierarchy View
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search hierarchy..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500 focus:ring-primary"
                    />
                  </div>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-[200px] bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="all" className="text-white focus:bg-zinc-800">All Departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept} className="text-white focus:bg-zinc-800">
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 mt-4 min-h-[300px]">
                  {loading ? (
                    <div className="flex items-center justify-center h-32 text-gray-500">Loading hierarchy...</div>
                  ) : filteredHierarchy.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-500 border border-dashed border-zinc-800 rounded-lg">
                      <Users className="h-8 w-8 mb-2 opacity-20" />
                      No members found matching your criteria
                    </div>
                  ) : (
                    <div className="pl-2">
                      {filteredHierarchy.map((node) => renderNode(node, 0))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white">All Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Filter list..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500 focus:ring-primary"
                    />
                  </div>
                  <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {profiles
                      .filter((profile) => {
                        const matchesSearch =
                          !searchQuery ||
                          profile.ecell_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          profile.title?.toLowerCase().includes(searchQuery.toLowerCase());
                        const matchesDepartment =
                          departmentFilter === "all" || profile.department === departmentFilter;
                        return matchesSearch && matchesDepartment;
                      })
                      .map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-colors"
                        >
                          <Avatar className="h-10 w-10 border border-zinc-700">
                            <AvatarImage src={profile.photo_url || ""} />
                            <AvatarFallback className="bg-zinc-800 text-gray-400">
                              <User className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-white text-sm">{profile.title || "Member"}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-zinc-700 text-gray-400">
                                {profile.role}
                              </Badge>
                              {profile.department && (
                                <span className="text-xs text-gray-500 truncate max-w-[100px]">
                                  {profile.department}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Organization;
