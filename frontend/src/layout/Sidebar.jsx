import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarSeparator,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LayoutDashboard, PlaySquare, Scissors, Camera,
  Upload, Users, Settings, Flame, BookmarkCheck,
} from 'lucide-react';

import { useAppContext } from '../context/AppContext';

const NAV_GROUPS = [
  {
    label: 'Analytics',
    items: [
      { path: '/',             label: 'Overview',      icon: LayoutDashboard },
      { path: '/videos',       label: 'All Videos',    icon: PlaySquare },
      { path: '/shorts',       label: 'Shorts',        icon: Scissors },
      { path: '/reels',        label: 'IG Content',    icon: Camera },
      { path: '/reddit-posts',    label: 'Reddit Posts',    icon: Flame },
      { path: '/reddit-tracked',  label: 'Tracked Posts',   icon: BookmarkCheck },
    ],
  },
  {
    label: 'Publishing',
    items: [
      { path: '/upload', label: 'Publish', icon: Upload },
    ],
  },
  {
    label: 'Management',
    items: [
      { path: '/accounts', label: 'Accounts', icon: Users },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accounts } = useAppContext();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      {/* Header */}
      <SidebarHeader className="border-b border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-default hover:bg-transparent active:bg-transparent"
            >
              <img src="/logo.png" alt="Twiligent" className="size-8 object-contain shrink-0" />
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-bold text-sm truncate">Twiligent</span>
                <span className="text-xs text-muted-foreground truncate">Analytics</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Nav groups */}
      <SidebarContent>
        {NAV_GROUPS.map((group, gi) => (
          <SidebarGroup key={gi}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={active}
                      onClick={() => navigate(item.path)}
                      tooltip={item.label}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            {gi < NAV_GROUPS.length - 1 && <SidebarSeparator className="mt-2" />}
          </SidebarGroup>
        ))}

        {/* Accounts quick list */}
        {accounts.length > 0 && (
          <SidebarGroup>
            <SidebarSeparator />
            <SidebarGroupLabel>Accounts</SidebarGroupLabel>
            <SidebarMenu>
              {accounts.map((acc) => {
                const isIG     = acc.platform === 'instagram';
                const isReddit = acc.platform === 'reddit';
                const path     = isIG ? `/instagram/${acc.id}` : isReddit ? `/reddit/${acc.id}` : `/channel/${acc.id}`;
                const initials = (acc.title || '?').slice(0, 2).toUpperCase();
                const avatarBg = isIG ? '#ec4899' : isReddit ? '#f97316' : '#ef4444';
                return (
                  <SidebarMenuItem key={acc.id}>
                    <SidebarMenuButton
                      isActive={location.pathname === path}
                      onClick={() => navigate(path)}
                      tooltip={acc.title}
                    >
                      <Avatar className="size-5 flex-shrink-0">
                        <AvatarImage
                          src={acc.thumbnail || acc.profilePictureUrl || acc.thumbnails?.default}
                          alt={acc.title}
                        />
                        <AvatarFallback
                          style={{ background: avatarBg }}
                          className="text-[0.5rem] font-bold text-white"
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">{acc.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate('/settings')}
              tooltip="Settings"
              className="text-muted-foreground"
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
